import inquirer from "inquirer";
import {DateTime} from "luxon";

/**
 *
 * @returns {Promise<{start: DateTime, end: DateTime}>}
 */
export async function inquireDate () {
    const answers = await inquirer.prompt([
        {
            name: 'period',
            type: 'list',
            message: 'Select period:',
            choices: [
                {
                    name: `Current Week (${DateTime.now().startOf('week').toISODate()} - ${DateTime.now().endOf('week').toISODate()})`,
                    value: 'current_week'
                },
                {
                    name: `Last Week (${DateTime.now().minus({ weeks: 1 }).startOf('week').toISODate()} - ${DateTime.now().minus({ weeks: 1 }).endOf('week').toISODate()})`,
                    value: 'last_week'
                },
                {
                    name: `Current Month (${DateTime.now().startOf('month').toISODate()} - ${DateTime.now().endOf('month').toISODate()})`,
                    value: 'current_month'
                },
                {
                    name: `Last Month (${DateTime.now().minus({ months: 1 }).startOf('month').toISODate()} - ${DateTime.now().minus({ months: 1 }).endOf('month').toISODate()})`,
                    value: 'last_month'
                },
                { name: 'Custom', value: 'custom' }
            ]
        },
        {
            name: 'start',
            type: 'input',
            message: 'Start Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
            when: (answers) => answers.period === 'custom'
        },
        {
            name: 'end',
            type: 'input',
            message: 'End Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
            when: (answers) => answers.period === 'custom'
        }
    ]);

    let start, end;

    switch (answers.period) {
        case 'current_week':
            start = DateTime.now().startOf('week').toISODate();
            end = DateTime.now().endOf('week').toISODate();
            break;
        case 'last_week':
            start = DateTime.now().minus({ weeks: 1 }).startOf('week').toISODate();
            end = DateTime.now().minus({ weeks: 1 }).endOf('week').toISODate();
            break;
        case 'current_month':
            start = DateTime.now().startOf('month').toISODate();
            end = DateTime.now().endOf('month').toISODate();
            break;
        case 'last_month':
            start = DateTime.now().minus({ months: 1 }).startOf('month').toISODate();
            end = DateTime.now().minus({ months: 1 }).endOf('month').toISODate();
            break;
        case 'custom':
            start = answers.start;
            end = answers.end;
            break;
    }

    start = DateTime.fromISO(start).setLocale('de');
    start.set({hour: 0, minute: 0, second: 0, millisecond: 0});
    end = DateTime.fromISO(end).setLocale('de');
    end.set({hour: 23, minute: 59, second: 59, millisecond: 999});

    if (end <= start) {
        console.error('End date must be after start date');
        process.exit(1);
    }

    return {start, end};
}