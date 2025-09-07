// limparEnvHistorico.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Caminho do repositório
const repoPath = process.cwd(); // assume que o script está dentro do repo

// Criar backup
const backupPath = path.join(repoPath, "..", "backup_repo");
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(backupPath);
}
console.log("Criando backup do repositório em:", backupPath);

// Copiar arquivos (simples, para evitar sobrescrita)
execSync(`xcopy "${repoPath}" "${backupPath}" /E /I /H /C /K /Y`, { stdio: "inherit" });

// Passo 1: verificar se git-filter-repo está instalado
try {
  execSync("git filter-repo --help", { stdio: "ignore" });
  console.log("git-filter-repo encontrado!");
} catch (err) {
  console.error("git-filter-repo não encontrado. Instale com: pip install git-filter-repo");
  process.exit(1);
}

// Passo 2: limpar histórico do .env
console.log("Removendo .env do histórico do Git...");
execSync("git filter-repo --path .env --invert-paths", { stdio: "inherit" });

// Passo 3: instruções para push
console.log("\nHistórico limpo. Agora você precisa fazer force push:");
console.log("git push origin --force --all");
console.log("git push origin --force --tags");

console.log("\n⚠️  Atenção: qualquer clone antigo precisará clonar novamente o repositório.");
