const dataFolder = './data/';
const reportsPath = dataFolder + 'report.json';
const inquirer = require("inquirer");;
const processReport = require("./src/processReport");
const report = require("./src/report");
const comments = require("./src/comments");

(async function run () {
    let answers = await inquirer.prompt([
        {
            name: 'action',
            type: 'list',
            message: 'Please choose an action',
            choices: [
                {name: 'Rerun Existing', value: 'rerun'},
                {name: 'Report to external Systems', value: 'report'},
            ]
        }
    ]);
    let data = null;

    console.log()

    switch (answers.action) {
        default:
            throw new Error('Unknown action ' + answers.action);
        case 'report':
            const success = await report()
            console.log('Reported %o', success);
            break;
        case 'rerun':
            data = await processReport(reportsPath);
            console.log('Existing report processed!');
            break;
    }

    console.log("");
    console.log(await comments({
        answers, data
    }));

})();

return;