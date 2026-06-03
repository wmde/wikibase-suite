# Install Wikibase Suite

Wikibase Suite is a production-ready Wikibase software bundle for self-hosting a public knowledge graph similar to Wikidata. It includes MediaWiki, Wikibase, Query Service, QuickStatements, and HTTPS routing for a public instance.

## 1. Requirements: What You Need to Install Wikibase Suite

<table width="100%" cellspacing="0" cellpadding="0" style="border-spacing: 0; margin: 0;">
<tr style="margin: 0; padding: 0;">
<td valign="top" width="48%" bgcolor="#eaf2ff" style="background-color: #eaf2ff; color: #000000; border-radius: 8px; padding: 14px; margin: 0;">
<h4 style="color: #000066; margin: 0 0 12px 0;">SERVER (VPS)</h4>

You need to have access to a Virtual Private Server (VPS) to install Wikibase Suite. Either your organization can provide a server or you rent from a provider. The minimum criteria must be fulfilled:

<ul>
<li>Server with a public IP address</li>
<li>Architecture: x86 (AMD/Intel)</li>
<li>RAM: min. 8 GB</li>
<li>Storage: min. 4 GB</li>
</ul>

</td>
<td width="4%" style="margin: 0; padding: 0;"></td>
<td valign="top" width="48%" bgcolor="#eaf2ff" style="background-color: #eaf2ff; color: #000000; border-radius: 8px; padding: 14px; margin: 0;">
<h4 style="color: #000066; margin: 0 0 12px 0;">DOMAIN REGISTRATION</h4>

You need a registered domain and subdomain for your Wikibase and the Query Service software:

<ul>
<li>Main domain for your Wikibase: <code>yourdomain.com</code></li>
<li>Subdomain for Query Service: <code>query.yourdomain.com</code></li>
</ul>

</td>
</tr>
</table>

## 2. Start the Wikibase Suite Installer

### Connect to Your Server

<table width="100%">
<tr>
<td valign="top">

<ul>
<li>Open a terminal program on your computer.</li>
<li>Access your server by entering the command below.</li>
<li>Enter the password generated for your server, or use your personal SSH key, depending on your server provider.</li>
</ul>

<pre><code>ssh root@SERVER_IP_ADDRESS</code></pre>

</td>
<td valign="top" align="right" width="380">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-2026-05-17-um-19.13.06.png.webp" alt="Terminal showing SSH access to the server" width="360">
</td>
</tr>
</table>

### Start the Installer

<table width="100%">
<tr>
<td valign="top">

<ul>
<li>Start setup by copying and pasting the command below.</li>
<li>Wait for the initial setup to finish. This can take about a minute.</li>
<li>Open the printed link in your web browser to start the Wikibase Suite Installer.</li>
</ul>

<pre><code>bash &lt;(curl -fsSL https://github.com/wmde/wikibase-suite/raw/main/install) --web</code></pre>

</td>
<td valign="top" align="right" width="380">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-2026-05-17-um-19.17.17.png.webp" alt="Terminal showing the installer URL" width="360">
</td>
</tr>
</table>

## 3. Configure and Install Wikibase Suite

<table width="100%">
<tr>
<td valign="top">
The Wikibase Suite Installer walks you through the steps to configure and install your Wikibase instance.
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-43-34.png.webp" alt="Wikibase Suite Installer welcome screen" width="240">
</td>
</tr>
</table>

<table width="100%">
<tr>
<td valign="top">
Configure your domain and subdomain:

<ul>
<li>Main domain for public access to your Wikibase.</li>
<li>Subdomain for the Query Service software.</li>
</ul>
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-43-50.png.webp" alt="Domain configuration screen" width="240">
</td>
</tr>
</table>

<table width="100%">
<tr>
<td valign="top">
Create an administrator account for your Wikibase:

<ul>
<li>Name</li>
<li>Email</li>
<li>Password</li>
</ul>
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-44-57.png.webp" alt="Administrator account screen" width="240">
</td>
</tr>
</table>

<table width="100%">
<tr>
<td valign="top">
<p><strong>Optional:</strong> set up database credentials.</p>

<p>The installer provides a default database configuration if you do not enter custom credentials.</p>
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-46-13.png.webp" alt="Database configuration screen" width="240">
</td>
</tr>
</table>

<table width="100%">
<tr>
<td valign="top">
<p>Run the installation for all Wikibase Suite components.</p>

<p>This might take a few minutes.</p>
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-25-01.png.webp" alt="Installation progress screen" width="240">
</td>
</tr>
</table>

<table width="100%">
<tr>
<td valign="top">

<p><strong>Congratulations:</strong> You have installed your own Wikibase instance!</p>

<p>You can directly access your Wikibase, the Query Service and QuickStatements – everything is configured and ready to use.</p>

<p>Note: <strong>Download the configuration file.</strong></p>
</td>
<td valign="top" align="right" width="260">
<img src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-27-26.png.webp" alt="Completed installation screen" width="240">
</td>
</tr>
</table>

## Support

If something is not working as expected, start with [Troubleshooting](./troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
