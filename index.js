const needle = require('needle');
const fs = require("fs");
const path = require("path");
const dataFolder = './data/';
const reportsPath = dataFolder + 'report.csv';
const inquirer = require("inquirer");;
const processReport = require("./src/processReport");
const report = require("./src/report");

(async function run () {
    let answers = await inquirer.prompt([
        {
            name: 'action',
            type: 'list',
            message: 'Please choose an action',
            choices: [
                {name: 'New Report', value: 'new'},
                {name: 'Rerun Existing', value: 'rerun'},
                {name: 'Report to external Systems', value: 'report'},
            ]
        }
    ]);

    console.log(answers.action);

    switch (answers.action) {
        default:
            throw new Error('Unknown action ' + answers.action);
        case 'report':
            const success = await report()
            console.log('Reported %o', success);
            break;
        case 'rerun':
            await processReport(reportsPath);
            console.log('Existing report processed!');
            break;
        case 'new':
            answers = await inquirer.prompt([
                {
                    name: 'sequence',
                    type: 'list',
                    message: 'Please choose the sequence of the new report',
                    choices: [
                        {name: 'Daily', value: 'daily'},
                        {name: 'Monthly', value: 'monthly'}
                    ]
                },
                {
                    name: 'from',
                    type: 'input',
                    message: 'Start time in yyyy-mm-dd format'
                },
                {
                    name: 'to',
                    type: 'input',
                    message: 'End time in yyyy-mm-dd format'
                }
            ]);

            // @todo - put some validations and credebility checks (to later then from e.g.)

            // clear the stage
            const files = await fs.promises.readdir(dataFolder);
            files.forEach(file => {
                fs.unlinkSync(path.join(dataFolder, file));
            });

            console.log('Downloading');

            needle.get('https://time.emphasize.de/util/report.php?export=csv&type=' + answers.sequence + '&token=6148lk4g4gk8c0c8wgo0&from=' + answers.from + '&to=' + answers.to + '&Submit=Show', {
                open_timeout: 30000
            }).pipe(fs.createWriteStream(reportsPath))
                .on('done', async function(err) {
                    await processReport(reportsPath);


                    console.log('New report downloaded & processed!');
                });

            break;
    }

})();

return;