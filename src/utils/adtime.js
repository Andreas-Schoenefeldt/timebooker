import needle from 'needle';

export class AdTimeClient {
    /**
     *
     * @type {{userId: string}}
     */
    user;
    host;
    apiBaseUrl;
    httpOptions;

    defaultLocation;

    /**
     *
     * @param {{host:string, authCookie: string, defaultLocation?: {locationId: string, locationName: string}}} options
     */
    constructor(options) {

        this.defaultLocation = options.defaultLocation;

        this.host = options.host;
        this.apiBaseUrl = this.host + '/eew-backend/api';
        this.httpOptions = {
            headers: {
                'content-type': 'application/json',
                'Cookie': options.authCookie,
            },
            rejectUnauthorized: false,
        };
    }

    async getCurrentUser () {
        if (!this.user) {
            const response = await needle('get', this.apiBaseUrl + '/authentication/actinguser', this.httpOptions);
            this.user = response.body;
        }

        return this.user;
    }

    async getCsfrToken() {
        const options = Object.assign({}, this.httpOptions);
        options.headers['x-csrf-token'] = 'Fetch';
        const response = await needle('head', this.host, options);

        return response.headers['x-csrf-token'];
    }

    /**
     *
     * @param {string} projectId
     * @param {DateTime} from
     * @param {DateTime} to
     * @param {string} outputFile
     * @returns {Promise<string>}
     */
    async downloadProjectReport(projectId, from, to, outputFile) {
        console.log(`Pulling hours from ${projectId}`);

        const user = await this.getCurrentUser();

        const url = new URL(`${this.apiBaseUrl}/employees/${user.userId}/reports/activity-report`);
        url.searchParams.append('startDate', from.toFormat('yyyy-MM-dd'));
        url.searchParams.append('endDate', to.toFormat('yyyy-MM-dd'));
        url.searchParams.append('projectId', projectId);
        url.searchParams.append('version', 'AZE_SEPARATED');
        url.searchParams.append('aceActivityTypes', '');

        console.log(url.toString());

        await needle('get', url.toString(), Object.assign({}, options, {
            output: outputFile
        }));

        return outputFile;
    }

    /**
     *
     * @param {string} projectId
     * @param {string} featureId
     * @param ticketId
     * @param {{comments: [], activity: entry.activity, dates: Record<string, {hours: number}>}} timesConfig
     * @returns {Promise<void>}
     */
    async bookWeek(projectId, featureId, ticketId, timesConfig) {
        const uuid = crypto.randomUUID();
        const records = Object.keys(timesConfig.dates).map((date) => {
            return {
                "projectId": projectId,
                "timeRecordGroupId": uuid,
                "featureId": featureId,
                "timeRecordBillingType": "KV",
                "timeRecordDate": date,
                "timeRecordDescription": `${ticketId}: ${timesConfig.comments.join(', ')}`,
                "timeRecordLocation": this.defaultLocation,
                "timeRecordHours": timesConfig.dates[date].hours.toFixed(2),
            }
        });

        const user = await this.getCurrentUser();
        const csfrToken = await this.getCsfrToken();

        const options = Object.assign({}, this.httpOptions);
        options.headers['x-csrf-token'] = csfrToken;

        return await needle('put', `${this.apiBaseUrl}/employees/${user.userId}/timerecords`, {
            "timeRecords": records
        }, options);
    }
}