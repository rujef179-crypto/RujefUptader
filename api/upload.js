import { Octokit } from "octokit";
import formidable from "formidable";
import fs from "fs-extra";
import path from "path";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send("Error al procesar el formulario");

    const apkFile = files.apkFile?.[0] || files.apkFile;
    if (!apkFile) return res.status(400).send("No se detectó ningún archivo APK");

    try {
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
      const branch = process.env.GITHUB_BRANCH || "main";
      const token = process.env.GITHUB_TOKEN;

      if (!owner || !repo || !token) 
        return res.status(500).send("Variables de entorno incompletas");

      const octokit = new Octokit({ auth: token });

      // Crear carpeta apk si no existe
      const apkDir = path.join(process.cwd(), "public", "apk");
      await fs.ensureDir(apkDir);

      // Leer APK y convertir a base64
      const fileBuffer = await fs.readFile(apkFile.filepath);
      const fileContent = fileBuffer.toString("base64");
      const newName = `app-${Date.now()}.apk`;
      const apkPath = `public/apk/${newName}`;

      // Subir APK a GitHub
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: apkPath,
        message: `Subida nueva versión ${fields.versionName}`,
        content: fileContent,
        branch
      });

      // Crear version.json
      const versionData = {
        versionCode: parseInt(fields.versionCode),
        versionName: fields.versionName,
        agregados: fields.agregados || "",
        correcciones: fields.correcciones || "",
        downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/public/apk/${newName}`
      };

      const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString("base64");

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: "public/version.json",
        message: `Actualización versión ${fields.versionName}`,
        content: versionContent,
        branch
      });

      res.status(200).send("✅ APK subida y version.json actualizado correctamente en GitHub.");
    } catch (e) {
      console.error("Error al subir APK:", e);
      res.status(500).send("❌ Error al subir el APK: " + e.message);
    }
  });
}
