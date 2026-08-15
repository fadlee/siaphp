import { Command } from "commander";
import { PACKAGE_VERSION } from "./constants.js";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";
import { deployCommand } from "./commands/deploy.js";

export async function run(argv) {
  const program = new Command();

  program
    .name("siaphp")
    .description("Deploy project PHP ke shared hosting tanpa SSH.")
    .version(PACKAGE_VERSION);

  program
    .command("init")
    .description("Hubungkan proyek ini ke siaphp agent.")
    .option("--structure <type>", "flat atau public")
    .option("--base-url <url>", "Base URL hosting tempat agent di-upload")
    .option("-y, --yes", "gunakan pilihan default tanpa wizard")
    .option("--allow-http", "izinkan URL HTTP untuk pengembangan lokal")
    .action(initCommand);

  program
    .command("doctor")
    .description("Periksa proyek lokal dan kesiapan agent.")
    .option("--allow-http", "izinkan URL HTTP untuk pengembangan lokal")
    .action(doctorCommand);

  program
    .command("deploy")
    .description("Kemas dan deploy proyek ke hosting.")
    .option("--verbose", "tampilkan informasi detail proses deploy")
    .option("--allow-http", "izinkan URL HTTP untuk pengembangan lokal")
    .action(deployCommand);

  await program.parseAsync(argv);
}
