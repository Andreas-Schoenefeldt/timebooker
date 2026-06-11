import needle from 'needle';

export class RedmineClient {
    /**
     *
     * @type {{id: number, email: string, full_name: string}}
     */
    user;
    host;
    apiBaseUrl;
    httpOptions;

    /**
     *
     * @param {{host:string, apiKey: string}} options
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
}