import needle from 'needle';

export class MocoClient {
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
        this.apiBaseUrl = this.host + '/api/v1';
        this.httpOptions = {
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Token token=' + options.apiKey,
            },
            rejectUnauthorized: false,
            json: true,
        };
    }

    async getCurrentUser () {
        if (!this.user) {
            const response = await needle('get', this.apiBaseUrl + '/profile', this.httpOptions);
            this.user = response.body;
        }

        return this.user;
    }

    /**
     *
     * @param {{ticket: string, date: string, time: number, comment: string, activity: string}} entry
     * @param {{customer: string, custom: {mocoProjectId?: number, mocoTaskId?: number}}} activity
     * @returns {Promise}
     */
    async reportEntry(entry, activity) {
        if (!activity.custom.mocoProjectId || !activity.custom.mocoTaskId) {
            console.log(activity);
            throw new Error('Missing mocoProjectId or mocoTaskId for activity ' + entry.activity );
        }

        const options = Object.assign({}, this.httpOptions);
        return await needle('post', `${this.apiBaseUrl}/activities`, {
            "date": entry.date,
            "description": `#${entry.ticket}: ${entry.comment}`,
            "project_id": activity.custom.mocoProjectId,
            "task_id": activity.custom.mocoTaskId,
            "seconds": entry.time * 60 * 60, // measured in seconds
            "remote_id": entry.ticket,
            "remote_url": "https://redmine.flowconcept.de/issues/" + entry.ticket,
        }, options);
    }
}