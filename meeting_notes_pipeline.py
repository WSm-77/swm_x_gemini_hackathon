"""Simulated AI meeting notes pipeline.

Flow:
1) Merge raw transcript + user shorthand with Gemini 1.5 Flash into Markdown.
2) Convert Markdown to HTML.
3) Upload HTML via Google Drive API and convert into a native Google Doc.
"""

from __future__ import annotations

import os
import time
from typing import Optional

import markdown
from dotenv import load_dotenv
from google import genai
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
]


def get_google_credentials(
    credentials_path: str = "credentials.json",
    token_path: str = "token.json",
) -> Credentials:
    """Load OAuth credentials from local files or trigger interactive login."""
    creds: Optional[Credentials] = None

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "w", encoding="utf-8") as token_file:
            token_file.write(creds.to_json())

    return creds


def build_drive_service(credentials: Credentials):
    """Create Drive API client.

    Uses v2 because this simulation explicitly requires convert=True on upload.
    """
    return build("drive", "v2", credentials=credentials)


def generate_meeting_markdown(transcript_text: str, shorthand_notes: str) -> str:
    """Call Gemini 1.5 Flash and return synthesized meeting notes in Markdown."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("Missing GEMINI_API_KEY environment variable.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
Combine this transcript and these shorthand notes into a professional meeting summary.
Use Markdown headers for Overview, Decisions, and Action Items.

Transcript:
{transcript_text}

User shorthand notes:
{shorthand_notes}
""".strip()

    # for m in client.models.list():
    #     print(m.name)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    if getattr(response, "text", None):
        return response.text.strip()

    # Fallback parse if SDK does not populate response.text.
    try:
        parts = response.candidates[0].content.parts
        joined = "\n".join(getattr(part, "text", "") for part in parts)
        if joined.strip():
            return joined.strip()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Gemini returned an unexpected response format.") from exc

    raise RuntimeError("Gemini returned an empty response.")


def markdown_to_html(markdown_text: str) -> str:
    """Convert Markdown string to HTML string."""
    return markdown.markdown(markdown_text, extensions=["extra", "sane_lists"])


def create_google_doc_from_html(
    drive_service,
    html_content: str,
    title: str = "AI Meeting Notes",
) -> str:
    """Upload HTML and let Drive convert it to a native Google Doc."""
    media = MediaInMemoryUpload(
        body=html_content.encode("utf-8"),
        mimetype="text/html",
        resumable=False,
    )

    created = (
        drive_service.files()
        .insert(
            body={"title": title, "mimeType": "application/vnd.google-apps.document"},
            media_body=media,
            convert=True,
        )
        .execute()
    )

    doc_id = created["id"]
    return f"https://docs.google.com/document/d/{doc_id}/edit"


def run_meeting_notes_pipeline(
    transcript_text: str,
    shorthand_notes: str,
    output_title: str = "AI Meeting Notes",
) -> str:
    """Run full simulation and return created Google Doc URL."""
    credentials = get_google_credentials()
    drive_service = build_drive_service(credentials)

    synthesized_markdown = generate_meeting_markdown(transcript_text, shorthand_notes)
    html_payload = markdown_to_html(synthesized_markdown)
    doc_url = create_google_doc_from_html(drive_service, html_payload, output_title)

    return doc_url


def run_meeting_notes_pipeline_with_metrics(
    transcript_text: str,
    shorthand_notes: str,
    output_title: str = "AI Meeting Notes",
) -> tuple[str, dict[str, float]]:
    """Run full pipeline and return the Google Doc URL with timing metrics (seconds)."""
    timings: dict[str, float] = {}
    total_start = time.perf_counter()

    auth_start = time.perf_counter()
    credentials = get_google_credentials()
    drive_service = build_drive_service(credentials)
    timings["auth_and_drive_setup"] = time.perf_counter() - auth_start

    synth_start = time.perf_counter()
    synthesized_markdown = generate_meeting_markdown(transcript_text, shorthand_notes)
    timings["gemini_prompt_to_markdown"] = time.perf_counter() - synth_start

    md_start = time.perf_counter()
    html_payload = markdown_to_html(synthesized_markdown)
    timings["markdown_to_html"] = time.perf_counter() - md_start

    upload_start = time.perf_counter()
    doc_url = create_google_doc_from_html(drive_service, html_payload, output_title)
    timings["drive_upload_and_doc_convert"] = time.perf_counter() - upload_start

    timings["total_pipeline"] = time.perf_counter() - total_start
    return doc_url, timings


if __name__ == "__main__":
    # Replace these with your own data to simulate a meeting run.
    sample_transcript = """
    Maya: Quick update on the AI meeting assistant MVP timeline.
    Daniel: Transcription ingestion is stable, but speaker label accuracy drops when cross-talk increases.
    Priya: For the demo, we can use simulated transcript blocks and focus on summary quality.
    Leo: Notes formatting in Google Docs works, but nested bullets are inconsistent in long outputs.
    Maya: Let's cap summary length to one page and keep sections to Overview, Decisions, and Action Items.
    Daniel: I can add a post-processing rule to normalize bullet indentation before upload.
    Priya: We also need a fallback message when the model returns empty content.
    Maya: Great, ship those fixes by Tuesday and record a 3-minute demo walkthrough.
    """.strip()

    sample_shorthand = """
    - M1 target: Apr 20
    - blocker: consent copy legal review
    - KPI: activation lift
    - design handoff by Friday
    """.strip()

    try:
        url, timings = run_meeting_notes_pipeline_with_metrics(
            transcript_text=sample_transcript,
            shorthand_notes=sample_shorthand,
            output_title="Hackathon - Meeting Summary",
        )
        print("Created Google Doc:")
        print(url)
        print("\nTiming (seconds):")
        for stage, value in timings.items():
            print(f"- {stage}: {value:.3f}s")
    except Exception as err:
        print("Pipeline failed:", err)
