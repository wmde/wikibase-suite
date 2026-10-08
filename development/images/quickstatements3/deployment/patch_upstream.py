import sys
from pathlib import Path


models_file = Path(sys.argv[1])
models = models_file.read_text()
old = '''    @property
    def rest_endpoint_url(self):
        return f"{self.url}/w/rest.php"

    @property
    def api_endpoint(self):
        return f"{self.url}/w/api.php"
'''
new = '''    @property
    def api_base_url(self):
        return settings.WIKIBASE_API_URL or self.url

    @property
    def rest_endpoint_url(self):
        return f"{self.api_base_url}/w/rest.php"

    @property
    def api_endpoint(self):
        return f"{self.api_base_url}/w/api.php"
'''
if models.count(old) != 1:
    raise SystemExit("Expected one upstream Wikibase endpoint block")
models = models.replace(old, new)

old_bot_edit = '''        body = self.api_payload(client)
        body["bot"] = True
        body["comment"] = self.edit_summary()
        return body
'''
new_bot_edit = '''        body = self.api_payload(client)
        body["comment"] = self.edit_summary()
        return body
'''
if models.count(old_bot_edit) != 1:
    raise SystemExit("Expected one upstream bot-edit payload block")
models_file.write_text(models.replace(old_bot_edit, new_bot_edit))
