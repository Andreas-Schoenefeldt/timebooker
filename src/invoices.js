import PDFMerger from 'pdf-merger-js';
import {inquireDate} from "./utils/date.js";
import byCustomer from "./../config/byCustomer.js";
import inquirer from "inquirer";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import H from 'just-handlebars-helpers';
import fs from "fs";
import {prepareReport} from "./prepare.js";


export default async function() {
    console.log('Choose the time for which to generate invoices:');

    Handlebars.registerHelper('call', function(context, methodName, ...args) {
        if (context && typeof context[methodName] === 'function') {
            return context[methodName].apply(context, args);
        }
        return '';
    });
    Handlebars.registerHelper('asMoney', function(amount) {
        return amount.toFixed(2).replace('.', ',') + ' €';
    });
    H.registerHelpers(Handlebars);

    const { start, end } = await inquireDate();

    // get the report
    console.log('Preparing a fresh report for invoices, this might take a while...');
    const entriesByCustomers = await prepareReport(start, end);

    let answers = {};
    const applicableCustomers = Object.keys(byCustomer).filter(customer => entriesByCustomers[customer] && typeof byCustomer[customer].invoiceData === 'function');
    const notApplicable = Object.keys(entriesByCustomers).filter(customer => !applicableCustomers.includes(customer));

    if (notApplicable.length) {
        console.log('');
        console.log('The following customers with efforts in the period are not configured for invoicing:');
        notApplicable.forEach(customer => console.log('  ' + customer + ' (' + entriesByCustomers[customer].totals.hours + ' hours)'));
        console.log('');
    }

    let processedCustomers = [];

    while (answers.customersOrAll !== 'all' && answers.customersOrAll !== 'none') {

        answers = await inquirer.prompt([
            {
                name: 'customersOrAll',
                type: 'list',
                message: 'Would you like to create invoices for a specific customer, or all?',
                default: 'all',
                choices: [
                    {name: '- NONE -', value: 'none'},
                    {name: '- ALL -', value: 'all'}
                ].concat(
                    applicableCustomers.sort().map(customer => ({name: customer + (processedCustomers.indexOf(customer) > -1 ? ' (done :-)' : ''), value: customer}))
                )
            }
        ]);

        let customers = answers.customersOrAll === 'all' ? applicableCustomers : [answers.customersOrAll];

        // Read and compile the Handlebars template from the 'templates' directory
        const templatePath = join(import.meta.dirname, '../config/templates', 'invoice.hbs');
        const templateSource = readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateSource);

        // Launch Puppeteer in headless mode
        const browser = await puppeteer.launch();

        for (let customer of customers) {
            // thx to https://pdfbolt.com/blog/generate-pdf-nodejs-puppeteer
            console.log('Generating invoice for %o', customer);

            // get the data from our protected function
            /** @type {InvoiceData[]} */
            const invoiceDataArray = await byCustomer[customer].invoiceData(start, end, {
                dataDir: join(import.meta.dirname, '../data'),
                entries: entriesByCustomers[customer],
            });

            for (let invoiceData of invoiceDataArray) {
                console.log('');
                console.log('---------------------------------------------------------------------');
                console.log('---------- Invoice for %o ' + '-'.repeat(43 - invoiceData.activity.length), invoiceData.activity);
                console.log('---------------------------------------------------------------------');

                let comparison = entriesByCustomers[customer].totals;
                if (invoiceData.activity !== 'all') {
                    comparison = entriesByCustomers[customer].perActivity[invoiceData.activity];
                }

                console.table(invoiceData.lines);
                console.table([
                    ['invoice number:', invoiceData.invoiceNumber],
                    ['hours invoiced:', invoiceData.hoursTotal.toFixed(2)],
                    ['hours tracked:', comparison.hours.toFixed(2)],
                    ['Netto:', invoiceData.netTotal.toFixed(2)],
                    ['Ust.:', invoiceData.tax.toFixed(2)],
                    ['Gesamt.:', invoiceData.total.toFixed(2)],
                ]);

                console.log('');

                if (comparison.hours > invoiceData.hoursTotal) {
                    console.error(`🚨  only invoicing ${invoiceData.hoursTotal}/${comparison.hours} hours for ${invoiceData.activity} (${(invoiceData.hoursTotal / comparison.hours * 100).toFixed(1)}%)`);
                }

                console.log('');

                const html = template(invoiceData);
                // writeFileSync(join(import.meta.dirname, '../data', invoiceData.invoiceNumber + '.html'), html);

                // Set the generated HTML as the page content and wait for it to load completely
                const page = await browser.newPage();
                await page.setContent(html, { waitUntil: 'networkidle0' });

                // Create a PDF from the HTML content and save it with a timestamped filename
                const pdfName = (invoiceData.invoiceFileName || invoiceData.invoiceNumber) + '.pdf';
                const pdfPath =  join(import.meta.dirname, '../data', pdfName);
                await page.pdf({
                    path: pdfPath,
                    format: 'A4',
                    printBackground: true // Ensures background colors and images are included
                    // Additional parameters can be added here if needed
                });

                if (invoiceData.attachments) {
                    const merger = new PDFMerger();

                    await merger.add(pdfPath);
                    for (let attachmentPath of invoiceData.attachments) {
                        await merger.add(attachmentPath);
                    }

                    await merger.setMetadata({
                        author: invoiceData.myself.name,
                        creator: invoiceData.myself.name,
                        title: `Rechnung ${invoiceData.invoiceNumber}`
                    });

                    await merger.save(pdfPath);
                }

                console.log(`✓ PDF successfully created at: ${pdfPath}`);
                const copyTarget = byCustomer.config.invoiceLocation + '/' + (byCustomer[customer].folderName || customer) + '/' + pdfName;
                await fs.promises.copyFile(pdfPath, copyTarget);
                console.log(`✓ PDF copied to ${copyTarget}`);
                console.log('');

                if (typeof byCustomer[customer].afterInvoice === 'function') {
                    await byCustomer[customer].afterInvoice(invoiceData);
                }
            }
            processedCustomers.push(customer);
        }

        // Close the browser after the PDFs are generated.
        await browser.close();
    }
}