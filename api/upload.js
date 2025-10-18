import { Octokit } from "@octokit/rest";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      return res.status(500).send("Error al procesar el formulario");
    }

    const apkFile = files.apkFile?.[0] || files.apkFile;
    if (!apkFile) return res.status(400).send("No se detectó ningún archivo APK");

    try {
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
      const branch = process.env.GITHUB_BRANCH || "main";
      const token = process.env.GITHUB_TOKEN;

      console.log("Environment variables:", { owner, repo, branch, token: token ? "***" : "missing" });

      if (!owner || !repo || !token) {
        return res.status(500).send("Variables de entorno incompletas");
      }

      const octokit = new Octokit({ auth: token });

      // Verificar que el repositorio existe y tenemos acceso
      try {
        await octokit.rest.repos.get({
          owner,
          repo
        });
        console.log("✅ Repositorio accesible");
      } catch (repoError) {
        console.error("❌ Error accediendo al repositorio:", repoError);
        return res.status(500).send("Error: No se puede acceder al repositorio. Verifica el nombre y permisos.");
      }

      // Leer APK y convertir a base64
      const fileBuffer = await fs.promises.readFile(apkFile.filepath);
      const fileContent = fileBuffer.toString("base64");
      const newName = `app-${fields.versionName}-${Date.now()}.apk`;
      const apkPath = `public/apk/${newName}`;

      console.log("Subiendo APK:", apkPath);

      // Subir APK a GitHub
      try {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: apkPath,
          message: `Subida nueva versión ${fields.versionName} (v${fields.versionCode})`,
          content: fileContent,
          branch,
          committer: {
            name: 'APK Uploader',
            email: 'uploader@example.com'
          }
        });
        console.log("✅ APK subido correctamente");
      } catch (uploadError) {
        console.error("❌ Error subiendo APK:", uploadError);
        throw new Error(`Error subiendo APK: ${uploadError.message}`);
      }

      // Crear version.json
      const versionData = {
        versionCode: parseInt(fields.versionCode),
        versionName: fields.versionName,
        agregados: fields.agregados || "",
        correcciones: fields.correcciones || "",
        downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${apkPath}`,
        timestamp: new Date().toISOString()
      };

      const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString("base64");

      console.log("Actualizando version.json");

      try {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: "public/version.json",
          message: `Actualización versión ${fields.versionName} (v${fields.versionCode})`,
          content: versionContent,
          branch,
          committer: {
            name: 'APK Uploader',
            email: 'uploader@example.com'
          }
        });
        console.log("✅ version.json actualizado correctamente");
      } catch (versionError) {
        console.error("❌ Error actualizando version.json:", versionError);
        throw new Error(`Error actualizando version.json: ${versionError.message}`);
      }

      // Limpiar archivo temporal
      await fs.promises.unlink(apkFile.filepath).catch(console.error);

      res.status(200).send("✅ APK subida y version.json actualizado correctamente en GitHub.");
    } catch (e) {
      console.error("Error general al subir APK:", e);
      
      // Limpiar archivo temporal en caso de error
      if (apkFile?.filepath) {
        await fs.promises.unlink(apkFile.filepath).catch(console.error);
      }
      
      res.status(500).send("❌ Error al subir el APK: " + e.message);
    }
  });
}
