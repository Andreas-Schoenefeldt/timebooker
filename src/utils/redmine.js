import needle from 'needle';

export class RedmineClient {
    /**
     *
     * @type {{id: number, email?: string, full_name?: string}|null}
     */
    user;
    host;
    apiBaseUrl;
    httpOptions;

    /**
     *
     * @param {{host:string, apiKey: string, userId?: number}} options
     */
    constructor(options) {
        this.host = options.host;
        this.apiBaseUrl = this.host;
        this.httpOptions = {
            headers: {
                'content-type': 'application/json',
                'X-Redmine-API-Key': options.apiKey,
            },
            rejectUnauthorized: false,
            json: true,
        };

        this.user = options.userId ? {id: options.userId} : null;
    }

    /**
     *
     * @param {{ticket: string, date: string, time: number, comment: string}} entry
     * @returns {Promise}
     */
    async reportEntry(entry) {
        const options = Object.assign({}, this.httpOptions);
        return await needle('post', `${this.apiBaseUrl}/time_entries.json`, {
            time_entry: {
                issue_id: entry.ticket,
                spent_on: entry.date,
                hours: entry.time,
                activity_id: '9',
                comments: entry.comment
            }
        }, options);
    }

    /**
     *
     * @param {DateTime} from
     * @param {DateTime} to
     * @returns {Promise<{hours: number, project: {id: number, name: string}}[]>}
     */
    async fetchReportedHours(from, to) {
        const options = Object.assign({}, this.httpOptions);

        const url = new URL(`${this.apiBaseUrl}/time_entries.json`);
        url.searchParams.append('from', from.toFormat('yyyy-MM-dd'));
        url.searchParams.append('to', to.toFormat('yyyy-MM-dd'));
        if (this.user?.id) {
            throw new Error('No User ID provided');
        }
        url.searchParams.append('user_id', this.user?.id);
        url.searchParams.append('limit', 100); // this is the maximum limit, the api allows
        const response = await needle('get', url.toString(), options);

        const body = response.body;

        if (body.total_count > body.limit) {
            throw new Error('More than 100 entries found. Please implement a loop pull.');
        }

        return body.time_entries;
    }
}