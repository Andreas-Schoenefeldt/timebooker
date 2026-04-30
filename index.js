import processReport from './src/processReport.js';
import report from './src/report.js';
import inquirer from "inquirer";
import byCustomer from "./config/byCustomer.js";
import invoices from "./src/invoices.js";
import prepare from "./src/prepare.js";
import * as fs from "node:fs";
import {promisify} from "node:util";
import {exec} from "child_process";

const dataFolder = './data/';
const reportsPath = dataFolder + 'report.json';

const ACTION_EXIT = 'EXIT';

const execAsync = promisify(exec); // For async/await

(async function run () {

    let answers = {action: ''};

    while (answers.action !== ACTION_EXIT) {
        answers = await inquirer.prompt([
            {
                name: 'action',
                type: 'list',
                message: 'Please choose an action',
                choices: [
                    {name: '- Exit -', value: ACTION_EXIT},
                    {name: 'Prepare a new report', value: 'prepare'},
                    {name: 'Rerun Existing (json)', value: 'rerun'},
                    {name: 'Rerun Existing (csv)', value: 'rerun_csv'},
                    {name: 'Report to external Systems', value: 'report'},
                    {name: 'Generate Invoices', value: 'invoices'}
                ]
            }
        ]);
        let data = null;
        let success = false;

        console.log()

        switch (answers.action) {
            default:
                throw new Error('Unknown action ' + answers.action);
            case 'prepare':
                console.log('Preparing a worktime report');

                success = await prepare();

                console.log('Done: %o', success ? 'OK' : 'ERROR');

                break;
            case 'report':
                answers = await inquirer.prompt([
                    {
                        name: 'customersOrAll',
                        type: 'list',
                        message: 'Would you like to report A specific customer, or all?',
                        default: 'all',
                        choices: [
                            {name: '- ALL -', value: 'all'}
                        ].concat(
                            Object.keys(byCustomer).sort().map((key) => {
                                return typeof byCustomer[key].report === 'function' ? {name: key, value: key} : null;
                            })).filter(i => i)
                    }
                ]);

                success = await report(answers.customersOrAll);
                console.log('Reported %o %o',answers.customersOrAll, success);
                break;
            case 'invoices':
                success = await invoices();
                break;
            case 'rerun':
                data = await processReport(reportsPath);
                console.log('Existing report processed!');
                break;
            case 'rerun_csv':
                const csvFiles = fs.readdirSync('./data/').filter(file => file.endsWith('.csv') && file.indexOf('time-emphasize_report') > -1);

                const csvAnswer = await inquirer.prompt([
                    {
                        name: 'csvFile',
                        type: 'list',
                        message: 'Select a CSV file to process:',
                        choices: csvFiles.map(file => ({ name: file, value: './data/' + file }))
                    }
                ]);

                data = await processReport(csvAnswer.csvFile);
                console.log('CSV report processed!');
                break;
            case ACTION_EXIT:
                // do nothing, this shall stop the loop
                break;
        }
    }
})();

// backup of the config directory, as there is so much work in the data functions
execAsync('cp -a -p ./config ' + byCustomer.config.backupFolder).then(/* silent */).catch(e => console.error(e));