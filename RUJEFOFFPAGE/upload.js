import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Método no permitido");
    return;
  }

  const form = new formidable.IncomingForm();
  const uploadDir = path.join(process.cwd(), "public", "apk");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  form.uploadDir = uploadDir;
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.status(500).send("Error al procesar el formulario");
      return;
    }

    const apkFile = files.apkFile;
    if (!apkFile) {
      res.status(400).send("No se detectó ningún archivo APK");
      return;
    }

    // Mantener solo 2 APKs: si hay más, borrar el más antiguo
    const apkFiles = fs.readdirSync(uploadDir)
        .filter(f => f.endsWith(".apk"))
        .map(f => ({ name: f, time: fs.statSync(path.join(uploadDir,f)).mtime.getTime() }))
        .sort((a,b) => a.time - b.time);

    while (apkFiles.length >= 2) {
      const oldest = apkFiles.shift();
      fs.unlinkSync(path.join(uploadDir, oldest.name));
    }

    // Renombrar el APK subido para que no choque
    const newName = `app-${Date.now()}.apk`;
    const newPath = path.join(uploadDir, newName);
    fs.renameSync(apkFile.filepath, newPath);

    // Crear o actualizar version.json
    const versionData = {
      versionCode: parseInt(fields.versionCode),
      versionName: fields.versionName,
      agregados: fields.agregados,
      correcciones: fields.correcciones,
      downloadUrl: `/apk/${newName}`
    };
    fs.writeFileSync(path.join(process.cwd(), "public", "version.json"), JSON.stringify(versionData, null, 2));

    res.status(200).send("✅ APK subida y version.json actualizada correctamente");
  });
}
