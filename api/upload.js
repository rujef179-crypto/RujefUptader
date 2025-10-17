import { Octokit } from "octokit";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    console.log("FIELDS recibidos:", fields);
    console.log("FILES recibidos:", files);

    const fileKeys = Object.keys(files);
    if (fileKeys.length === 0) {
      return res.status(400).send("No se detectó ningún archivo");
    }

    const apkFile = files[fileKeys[0]];
    const filePath = apkFile.filepath || apkFile.file?.filepath || apkFile.path;
    if (!filePath) return res.status(400).send("No se encontró el archivo APK correctamente");

    console.log("Archivo APK detectado:", filePath);

    const fileBuffer = await fs.promises.readFile(filePath);
    const fileContent = fileBuffer.toString("base64");

    const newName = `app-${Date.now()}.apk`;
    const apkPath = `public/apk/${newName}`;

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path: apkPath,
      message: `Subida nueva versión ${fields.versionName || "sin nombre"}`,
      content: fileContent,
      branch,
    });

    const versionData = {
      versionCode: parseInt(fields.versionCode) || 0,
      versionName: fields.versionName || "sin nombre",
      agregados: fields.agregados || "",
      correcciones: fields.correcciones || "",
      downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/public/apk/${newName}`
    };

    const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString("base64");

    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path: "public/version.json",
      message: `Actualización versión ${fields.versionName || "sin nombre"}`,
      content: versionContent,
      branch,
    });

    res.status(200).send("✅ APK subida y version.json actualizado correctamente en GitHub.");
  } catch (e) {
    console.error("Error al subir APK:", e);
    res.status(500).send("❌ Error al subir el APK: " + e.message);
  }
}
