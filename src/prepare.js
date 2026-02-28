import {inquireDate} from "./utils/date.js";
import source from '../config/source.json' with {type: "json"};
import needle from "needle";
import {DateTime} from "luxon";
import * as fs from "node:fs";
import processReport from "./processReport.js";
import {join} from "node:path";

/**
 *
 * @param start
 * @param end
 * @returns {Promise<Record<string,{perWeek: Record<string, *>, perDay: Record<string,*>,perActivity: Record<string, {}>, totals: {hours: number, comments: string[], activities: string[]}, result: *[]}>>}
 */
export async function prepareReport(start, end) {
    const url = source.host + '/report.php?group=day&quantisize=1&includeInfos=true&includeColors=false&topic=' + source.access + '&from=' + start.toMillis() + '&to=' + end.toMillis();
    console.log('Fetching data from ' + url);

    const res = await needle('get', url);

    /**
     * @type {{start: number, name: string, time: number, infos?: {s: string, i: string}[]}[]}
     */
    const entries = res.body.entries;
    const clean = [];


    entries.forEach((entry) => {

        if (entry.time && entry.name && entry.name !== 'Pause') {
            const minutes = Math.round(entry.time / 60000);

            if (minutes > 1) {
                const day = DateTime.fromMillis(entry.start);

                clean.push({
                    date: day.toFormat('yyyy-MM-dd'),
                    activity: entry.name,
                    minutes: minutes,
                    info: entry.infos ? entry.infos.map((info) => {return info.i.trim().replace('teh', 'the')}) : []
                })
            }
        }
    });

    const dataDir = './data/';
    const reportsPath =  dataDir + 'report.json';

    for (const file of await fs.promises.readdir(dataDir)) {
        await fs.promises.unlink(join(dataDir, file));
    }

    await fs.promises.writeFile(reportsPath, JSON.stringify(clean, null, 2));

    const entriesByCustomers = await processReport(reportsPath);

    console.log('Report processed and written.');
    return entriesByCustomers;
}


export default async function() {

    const { start, end } = await inquireDate();

    return await prepareReport(start, end);
}