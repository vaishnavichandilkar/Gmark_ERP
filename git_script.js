const { exec } = require('child_process');
const fs = require('fs');

async function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            resolve(`-- OUT --\n${stdout}\n-- ERR --\n${stderr}\n-- CODE --\n${error ? error.code : 0}`);
        });
    });
}

async function main() {
    let out = '';
    out += 'STATUS:\n' + await runCommand('git status');
    out += 'BRANCH:\n' + await runCommand('git branch');
    fs.writeFileSync('git_result.txt', out);
}
main();
