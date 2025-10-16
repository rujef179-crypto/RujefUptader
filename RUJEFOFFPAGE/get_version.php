<?php
header('Content-Type: application/json');

// Asegurarse de que el archivo exista
if (file_exists('version.json')) {
    readfile('version.json'); // Envía el JSON crudo
} else {
    echo json_encode([
        "error" => "No se encontró version.json"
    ]);
}
?>
