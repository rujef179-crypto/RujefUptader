import { Octokit } from "octokit";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const form = formidable({ multiples: false, keepExtensions: true });

  try {
    const { fields, files } = await form.parse(req);

    console.log("FIELDS recibidos:", fields);
    console.log("FILES recibidos:", files);

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    if (!owner || !repo || !process.env.GITHUB_TOKEN) {
      return res.status(500).send("❌ Variables de entorno incompletas");
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const apkFile = files.apkFile;
    if (!apkFile) return res.status(400).send("No se encontró el archivo APK correctamente");

    // Si formidable devuelve un array, usamos el primero
    const file = Array.isArray(apkFile) ? apkFile[0] : apkFile;

    console.log("Archivo APK detectado:", file.filepath);

    const fileBuffer = await fs.promises.readFile(file.filepath);
    const fileContent = fileBuffer.toString("base64");

    const newName = `app-${Date.now()}.apk`;
    const apkPath = `public/apk/${newName}`;

    // Subida a GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: apkPath,
      message: `Subida nueva versión ${fields.versionName}`,
      content: fileContent,
      branch,
    });

    const versionData = {
      versionCode: parseInt(fields.versionCode),
      versionName: fields.versionName,
      agregados: fields.agregados,
      correcciones: fields.correcciones,
      downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/public/apk/${newName}`,
    };

    const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString("base64");

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "public/version.json",
      message: `Actualización versión ${fields.versionName}`,
      content: versionContent,
      branch,
    });

    res.status(200).send("✅ APK subida y version.json actualizado correctamente en GitHub.");
  } catch (err) {
    console.error("Error al subir APK:", err);
    res.status(500).send("❌ Error al subir el APK: " + err.message);
  }
}
