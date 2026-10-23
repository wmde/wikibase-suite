import sys
from pathlib import Path

# Compatibility with Suite's MediaWiki 1.46 / Wikibase REL1_46 pin.
# QS3 main sends bot=true so accounts with the bot right get bot-marked edits.
# The Wikibase REST API fix in https://phabricator.wikimedia.org/T421631
# ignores that flag for accounts without the right, but our pinned REL1_46
# commit still rejects their edits with HTTP 403. Remove the flag for now so
# ordinary users can edit; bot accounts' QS3 edits will not be bot-marked.
# When Suite moves to MediaWiki 1.47, verify its pinned Wikibase REL1_47
# commit includes T421631, then remove this patch and its Dockerfile step.

models_file = Path(sys.argv[1])
models = models_file.read_text()
old_bot_edit = """        body = self.api_payload(client)
        body["bot"] = True
        body["comment"] = self.edit_summary()
        return body
"""
new_bot_edit = """        body = self.api_payload(client)
        body["comment"] = self.edit_summary()
        return body
"""
if models.count(old_bot_edit) != 1:
    raise SystemExit("Expected one upstream bot-edit payload block")
models_file.write_text(models.replace(old_bot_edit, new_bot_edit))
