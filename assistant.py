"""StudentMate assistant API and local static-file server.

Run with ``OPENAI_API_KEY=... python assistant.py`` for model-powered replies.
Without an API key, the deterministic offline assistant remains available.
"""

from datetime import date, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import ast
import math
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def due_date(value: str) -> str:
    if value.lower() == "today":
        return date.today().isoformat()
    if value.lower() == "tomorrow":
        return (date.today() + timedelta(days=1)).isoformat()
    return value


def safe_math_answer(prompt: str) -> str | None:
    """Solve basic arithmetic without evaluating arbitrary Python code."""
    expression = re.sub(r"^(what is|calculate|solve)\s+", "", prompt.strip(), flags=re.IGNORECASE).rstrip("?").strip()
    if not expression or not re.fullmatch(r"[0-9+\-*/().%\s^]+", expression):
        return None
    try:
        tree = ast.parse(expression.replace("^", "**"), mode="eval")

        def evaluate(node: ast.AST) -> float:
            if isinstance(node, ast.Expression):
                return evaluate(node.body)
            if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                return float(node.value)
            if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
                value = evaluate(node.operand)
                return value if isinstance(node.op, ast.UAdd) else -value
            if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)):
                left, right = evaluate(node.left), evaluate(node.right)
                operations = {ast.Add: lambda: left + right, ast.Sub: lambda: left - right, ast.Mult: lambda: left * right, ast.Div: lambda: left / right, ast.Pow: lambda: left ** right, ast.Mod: lambda: left % right}
                return operations[type(node.op)]()
            raise ValueError("unsupported expression")

        result = evaluate(tree)
        if not math.isfinite(result):
            return None
        formatted = str(int(result)) if result.is_integer() else f"{result:.10g}"
        return f"The answer is {formatted}."
    except (SyntaxError, ValueError, ZeroDivisionError, OverflowError):
        return None


def science_answer(prompt: str) -> str | None:
    """Answer common science concepts when the external model is unavailable."""
    question = prompt.lower()
    answers = {
        "photosynthesis": "Photosynthesis is the process plants use to make food from sunlight, water, and carbon dioxide. It produces glucose and releases oxygen.",
        "gravity": "Gravity is the attractive force between objects with mass. On Earth, it accelerates falling objects at about 9.8 m/s².",
        "force": "A force is a push or pull that can change an object's motion. Force is measured in newtons and is described by F = m × a.",
        "atom": "An atom is the basic unit of an element. It has a nucleus containing protons and neutrons, surrounded by electrons.",
        "dna": "DNA is the molecule that stores hereditary instructions. Its sequence helps cells make proteins and pass traits to new cells.",
        "electricity": "Electricity is the movement or presence of electric charge. Current is measured in amperes, voltage in volts, and resistance in ohms.",
        "water cycle": "The water cycle describes evaporation, condensation, precipitation, and collection as water continually moves through the environment.",
        "newton": "Newton's laws explain motion: objects resist changes in motion, acceleration depends on force and mass, and forces occur in equal and opposite pairs.",
        "ph": "pH measures how acidic or basic a water-based solution is. A pH below 7 is acidic, 7 is neutral, and above 7 is basic.",
    }
    for topic, answer in answers.items():
        if topic in question:
            return answer
    return None


def offline_reply(prompt: str, tasks: list[dict]) -> dict:
    """Handle common commands when no model provider is configured."""
    command = prompt.strip()
    task_match = re.match(
        r"^(?:please\s+)?(?:add|create)\s+(?:a\s+)?task\s+(.+?)\s+due\s+(today|tomorrow|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}:\d{2}))?$",
        command,
        re.IGNORECASE,
    )
    reminder_match = re.match(
        r"^(?:please\s+)?remind\s+me\s+to\s+(.+?)\s+at\s+(\d{1,2}:\d{2})$",
        command,
        re.IGNORECASE,
    )

    created_task = None
    if task_match:
        task_due = due_date(task_match.group(2))
        reminder_at = f"{task_due}T{task_match.group(3)}" if task_match.group(3) else ""
        created_task = {
            "title": task_match.group(1).strip(),
            "subject": "General",
            "dueDate": task_due,
            "priority": "medium",
            "completed": False,
            "reminderAt": reminder_at,
        }
        text = f"Done. I added '{created_task['title']}' for {task_due}."
        if reminder_at:
            text += f" I will remind you at {task_match.group(3)}."
    elif reminder_match:
        task_due = date.today().isoformat()
        created_task = {
            "title": reminder_match.group(1).strip(),
            "subject": "General",
            "dueDate": task_due,
            "priority": "medium",
            "completed": False,
            "reminderAt": f"{task_due}T{reminder_match.group(2)}",
        }
        text = f"Done. I added '{created_task['title']}' for today and will remind you at {reminder_match.group(2)}."
    elif re.search(r"how am i doing|progress|status", command, re.IGNORECASE):
        completed = sum(task.get("completed", False) for task in tasks)
        text = f"You have completed {completed} task(s) and have {len(tasks) - completed} still to do. Pick one small pending task and give it 25 focused minutes."
    elif re.search(r"what should i study|study next|suggest", command, re.IGNORECASE):
        next_task = next((task for task in tasks if not task.get("completed")), None)
        text = f"Start with '{next_task['title']}' and give it 25 focused minutes." if next_task else "You have no pending tasks. Add one clear study goal for your next session."
    elif re.search(r"plan|schedule", command, re.IGNORECASE):
        pending = [task["title"] for task in tasks if not task.get("completed")][:2]
        text = "Your focused plan:\n1. " + "\n2. ".join(pending) + "\n3. Take a 10-minute review break." if pending else "Create one task with a due date and I will help you plan it."
    elif (subject_answer := safe_math_answer(command)):
        text = subject_answer
    elif (subject_answer := science_answer(command)):
        text = subject_answer
    elif re.search(r"^(hi|hello|hey|good morning|good afternoon|good evening)\b", command, re.IGNORECASE):
        text = "Hi! I can answer study questions, explain concepts, create tasks, and help you plan your study time."
    elif re.search(r"who are you|what can you do|help", command, re.IGNORECASE):
        text = "I am your StudentMate study assistant. I can explain lessons, create tasks and reminders, review your progress, and build a study plan."
    elif re.search(r"can we be friends?|be my friend|are you my friend", command, re.IGNORECASE):
        text = "Of course. I am happy to be your study companion. I can listen, help you learn, and keep you on track whenever you need me."
    elif re.search(r"thank you|thanks|thx", command, re.IGNORECASE):
        text = "You're welcome. I am glad I could help."
    elif re.search(r"^(bye|goodbye|see you|see ya)\b", command, re.IGNORECASE):
        text = "See you later. Keep going with your studies, one small step at a time."
    elif re.fullmatch(r"\d+", command):
        text = f"You sent {command}. Tell me what you want me to do with it, such as explain a topic, create a task, or make a study plan."
    elif re.fullmatch(r"[a-zA-Z]+", command) and len(command) <= 6:
        text = f"I heard '{command}'. Could you tell me a little more about what you need?"
    else:
        text = "I want to help with that. Could you add a little more detail or tell me the subject? For example: 'Explain gravity' or 'Make a study plan for biology.'"

    return {"reply": text, "task": created_task, "provider": "offline"}


def model_reply(prompt: str, tasks: list[dict]) -> dict | None:
    """Ask an OpenAI-compatible chat API for a structured assistant response."""
    if not OPENAI_API_KEY:
        return None

    system_message = (
        "You are StudentMate's helpful study assistant. Answer the student's exact question clearly and concisely. "
        "You may help with studying, planning, explanations, and tasks. Return valid JSON only with keys "
        "reply (string) and task (object or null). Only include task when the user explicitly asks to create a task "
        "or reminder. A task must use keys title, subject, dueDate, priority, completed, reminderAt. "
        f"The student's current tasks are: {json.dumps(tasks, ensure_ascii=False)}"
    )
    request_body = json.dumps({
        "model": OPENAI_MODEL,
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt.strip()},
        ],
    }).encode("utf-8")
    request = Request(
        f"{OPENAI_BASE_URL}/chat/completions",
        data=request_body,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        result = json.loads(content)
        if not isinstance(result.get("reply"), str):
            raise ValueError("Model response did not include a reply")
        return {"reply": result["reply"], "task": result.get("task"), "provider": "openai"}
    except (HTTPError, URLError, KeyError, TypeError, ValueError, json.JSONDecodeError, TimeoutError):
        return None


def reply(prompt: str, tasks: list[dict]) -> dict:
    return model_reply(prompt, tasks) or offline_reply(prompt, tasks)


class AriaHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/assistant":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            result = reply(str(payload.get("prompt", "")), payload.get("tasks", []))
        except (ValueError, json.JSONDecodeError, TypeError):
            self.send_error(400, "Invalid JSON request")
            return
        body = json.dumps(result).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    provider = OPENAI_MODEL if OPENAI_API_KEY else "offline fallback"
    print(f"StudentMate assistant listening on http://localhost:8000 ({provider})")
    ThreadingHTTPServer(("localhost", 8000), AriaHandler).serve_forever()