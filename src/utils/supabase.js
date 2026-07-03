import {createClient} from "@supabase/supabase-js";
import {getAverageUsdToEur} from "./moneyExchange.js";
import byCustomer from "./../../config/byCustomer.js";
import activities from "./../../config/activities.json" with {type: "json"};

export class SupabaseClient {

    options;
    client;

    /**
     *
     * @param {{url: string, key: string, table: string}} options
     */
    constructor(options) {
        this.options = options;

        this.client = createClient(options.url, options.key);
    }

    /**
     *
     * @param {string} project
     * @param {DateTime} start
     * @param {DateTime} end
     * @returns {Promise<number>}
     */
    async getCostForRange(project, start, end){
        const { data } = await this.client
            .from(this.options.table)
            .select('cost')
            .eq('project', project)
            .gte('day', parseInt(start.toISODate().replace(/-/gi, ''), 10))
            .lte('day', parseInt(end.toISODate().replace(/-/gi, ''), 10))

        const cost = Math.round(data.reduce((acc, row) => acc + row.cost, 0) * 100) / 100;

        if (cost > 0) {
            const exchangeRate = await getAverageUsdToEur(start, end);
            const costEur = Math.round(cost * exchangeRate * 100) / 100;
            console.log(`USD ${cost} AI cost for ${project}:  ${costEur} EUR`);
            return costEur;
        }

        return 0;
    }

    async mapCostToTimeForProject(project, start, end) {
        const costEur = await this.getCostForRange(project, start, end);

        const customer = activities[project]?.customer;
        const costPerMinute = (byCustomer[customer].rate || 70) / 60;

        const extraMinutes = Math.ceil(costEur / costPerMinute);

        console.log(`Cost for ${project}: ${costEur} EUR amounts to ${extraMinutes} extra minutes`);

        return extraMinutes;
    }

}