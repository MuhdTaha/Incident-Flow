from app.core.invite_email import send_org_invite_email


def test_send_prefers_smtp_when_host_set(monkeypatch):
  monkeypatch.delenv("RENDER", raising=False)
  monkeypatch.setenv("SMTP_HOST", "mailhog")
  monkeypatch.setenv("SMTP_PORT", "1025")
  monkeypatch.setenv("MAILJET_API_KEY", "k")
  monkeypatch.setenv("MAILJET_API_SECRET", "s")
  sent = []

  def fake_smtp(to_email, subject, html, text, host, port, sender):
    sent.append(("smtp", to_email, host, port, sender))

  monkeypatch.setattr("app.core.invite_email._send_smtp", fake_smtp)
  monkeypatch.setattr(
    "app.core.invite_email._send_mailjet",
    lambda *args, **kwargs: sent.append("mailjet"),
  )

  send_org_invite_email("alex@company.com", "Acme", "https://app.example/invite")

  assert sent == [("smtp", "alex@company.com", "mailhog", 1025, "alerts@incidentflow.email")]


def test_send_uses_mailjet_on_render_even_if_smtp_host_is_mailhog(monkeypatch):
  monkeypatch.setenv("RENDER", "true")
  monkeypatch.setenv("SMTP_HOST", "mailhog")
  monkeypatch.setenv("MAILJET_API_KEY", "k")
  monkeypatch.setenv("MAILJET_API_SECRET", "s")
  sent = []

  def fake_mailjet(to_email, subject, html, text, api_key, api_secret, sender):
    sent.append(("mailjet", to_email, sender))

  monkeypatch.setattr("app.core.invite_email._send_mailjet", fake_mailjet)
  monkeypatch.setattr(
    "app.core.invite_email._send_smtp",
    lambda *args, **kwargs: sent.append("smtp"),
  )

  send_org_invite_email("alex@company.com", "Acme", "https://app.example/invite")

  assert sent == [("mailjet", "alex@company.com", "alerts@incidentflow.email")]


def test_send_uses_mailjet_when_smtp_unset(monkeypatch):
  monkeypatch.delenv("SMTP_HOST", raising=False)
  monkeypatch.delenv("RENDER", raising=False)
  monkeypatch.setenv("MAILJET_API_KEY", "k")
  monkeypatch.setenv("MAILJET_API_SECRET", "s")
  monkeypatch.setenv("MAILJET_SENDER_EMAIL", "invites@incidentflow.email")
  sent = []

  def fake_mailjet(to_email, subject, html, text, api_key, api_secret, sender):
    sent.append((to_email, api_key, sender, subject, text))

  monkeypatch.setattr("app.core.invite_email._send_mailjet", fake_mailjet)
  monkeypatch.setattr(
    "app.core.invite_email._send_smtp",
    lambda *args, **kwargs: sent.append("smtp"),
  )

  send_org_invite_email("alex@company.com", "Acme", "https://app.example/invite")

  assert sent[0][0] == "alex@company.com"
  assert sent[0][1] == "k"
  assert sent[0][2] == "invites@incidentflow.email"
  assert sent[0][3] == "Join Acme on IncidentFlow"
  assert "https://app.example/invite" in sent[0][4]


def test_send_mailjet_disables_click_tracking(monkeypatch):
  monkeypatch.delenv("SMTP_HOST", raising=False)
  monkeypatch.setenv("MAILJET_API_KEY", "k")
  monkeypatch.setenv("MAILJET_API_SECRET", "s")
  captured = {}

  class FakeResult:
    status_code = 200

    def json(self):
      return {"Messages": [{"Status": "success"}]}

  class FakeClient:
    def __init__(self, *args, **kwargs):
      def create(data):
        captured["data"] = data
        return FakeResult()

      self.send = type("Send", (), {"create": staticmethod(create)})()

  monkeypatch.setattr("app.core.invite_email.Client", FakeClient)
  send_org_invite_email("alex@company.com", "Acme", "https://app.example/invite#token")

  message = captured["data"]["Messages"][0]
  assert message["TrackClicks"] == "disabled"
  assert message["TrackOpens"] == "disabled"
  assert "https://app.example/invite#token" in message["TextPart"]


def test_send_mailjet_rejects_unsuccessful_message(monkeypatch):
  monkeypatch.delenv("SMTP_HOST", raising=False)
  monkeypatch.setenv("MAILJET_API_KEY", "k")
  monkeypatch.setenv("MAILJET_API_SECRET", "s")

  class FakeResult:
    status_code = 200

    def json(self):
      return {"Messages": [{"Status": "error", "Errors": [{"ErrorMessage": "blocked"}]}]}

  class FakeClient:
    def __init__(self, *args, **kwargs):
      self.send = type("Send", (), {"create": staticmethod(lambda data: FakeResult())})()

  monkeypatch.setattr("app.core.invite_email.Client", FakeClient)

  try:
    send_org_invite_email("blocked@example.com", "Acme", "https://app.example/invite")
  except RuntimeError as exc:
    assert "mailjet" in str(exc).lower()
  else:
    raise AssertionError("expected RuntimeError")


def test_send_raises_when_unconfigured(monkeypatch):
  monkeypatch.delenv("SMTP_HOST", raising=False)
  monkeypatch.delenv("MAILJET_API_KEY", raising=False)
  monkeypatch.delenv("MAILJET_API_SECRET", raising=False)

  try:
    send_org_invite_email("alex@company.com", "Acme", "https://app.example/invite")
  except RuntimeError as exc:
    assert "not configured" in str(exc).lower()
  else:
    raise AssertionError("expected RuntimeError")
