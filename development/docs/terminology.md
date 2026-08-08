# Documentation Terminology

Current terminology conventions and presentation choices currently used in Wikibase Suite documentation.

## Wikibase Suite, Wikibase Suite (WBS), and WBS

**Wikibase Suite** is the product name. **WBS** is its standard abbreviation.

- Directory README titles establish the documentation area and normally include the full product name. For example: **Installing Wikibase Suite (WBS)**, **Operating Wikibase Suite (WBS)**, and **Wikibase Suite (WBS) Wikibase Docker Image**.

- When a page title includes the product name, write **Wikibase Suite (WBS)**. Do not use bare **Wikibase Suite** or **WBS** in a page title. When a page title names the Docker Image collection, write **Wikibase Suite (WBS) Docker Images**.

- Documents within those areas normally rely on that context and name only their task or subject: use **Resetting an Instance** or **Troubleshooting** rather than repeating the product name. Root-level reference documents and documents that need to stand on their own outside the directory context may include the product name, as in **Wikibase Suite (WBS) Glossary**, **Wikibase Suite (WBS) Versions**, or **Upgrading Wikibase Suite (WBS) from 7 to 8**.

- Prefer **Wikibase Suite (WBS)** again at the first meaningful reference in the body, even when the page title has already introduced the abbreviation. In the rest of the page, use either **Wikibase Suite** when the full product name reads better or **WBS** when the abbreviation is clearer and more concise. Do not repeatedly write **Wikibase Suite (WBS)** in body text.

- Use **WBS** in navigation labels, repeated procedural instructions, and compound terms such as **WBS release**, **WBS configuration**, and **WBS Docker Images**. A short label other than a page title may use **WBS** without defining it when the surrounding page has already established the meaning.

- Do not use **Wikibase** as shorthand for **Wikibase Suite**. Wikibase is a service within WBS and is distributed through the Wikibase Docker Image.

## WBS Docker Image Terminology

- Prefer the forms containing **Docker**. Use **WBS Image** or **WBS Images** only when nearby text has already established that the subject is Docker images.

- Keep **image** lowercase when it is a generic technical noun or refers back to a product name already given. For example:
  - A Docker image is a read-only package.
  - Pull the image before starting the container.
  - The Wikibase Docker Image publishes several image tags.
