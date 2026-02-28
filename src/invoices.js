import PDFMerger from 'pdf-merger-js';
import {inquireDate} from "./utils/date.js";
import byCustomer from "./../config/byCustomer.js";
import inquirer from "inquirer";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";
import handlebars from "handlebars";


export default async function() {
    console.log('Choose the time for which to generate invoices:');

    handlebars.registerHelper('call', function(context, methodName, ...args) {
        if (context && typeof context[methodName] === 'function') {
            return context[methodName].apply(context, args);
        }
        return '';
    });

    handlebars.registerHelper('asMoney', function(amount) {
        return amount.toFixed(2).replace('.', ',') + ' €';
    });

    const applicableCustomers = Object.keys(byCustomer).filter(customer => typeof byCustomer[customer].invoiceData === 'function');
    const answers = await inquirer.prompt([
        {
            name: 'customersOrAll',
            type: 'list',
            message: 'Would you like to create invoices for a specific customer, or all?',
            default: 'all',
            choices: [
                {name: '- ALL -', value: 'all'}
            ].concat(
                applicableCustomers.map(customer => ({name: customer, value: customer}))
            )
        }
    ]);

    const { start, end } = await inquireDate();

    let customers = answers.customersOrAll === 'all' ? applicableCustomers : [answers.customersOrAll];

    // Read and compile the Handlebars template from the 'templates' directory
    const templatePath = join(import.meta.dirname, '../config/templates', 'invoice.hbs');
    const templateSource = readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch();

    for (let customer of customers) {
        // thx to https://pdfbolt.com/blog/generate-pdf-nodejs-puppeteer
        console.log('Generating invoice for %o', customer);

        // get the data from our protected function
        /** @type {InvoiceData[]} */
        const invoiceDataArray = await byCustomer[customer].invoiceData(start, end, {
            dataDir: join(import.meta.dirname, '../data'),
        });

        for (let invoiceData of invoiceDataArray) {

            console.table(invoiceData.lines);
            console.table([
                ['Netto:', invoiceData.netTotal.toFixed(2)],
                ['Ust.:', invoiceData.tax.toFixed(2)],
                ['Gesamt.:', invoiceData.total.toFixed(2)],
            ]);

            console.log('');

            const html = template(invoiceData);
            // writeFileSync(join(import.meta.dirname, '../data', invoiceData.invoiceNumber + '.html'), html);

            // Set the generated HTML as the page content and wait for it to load completely
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            // Create a PDF from the HTML content and save it with a timestamped filename
            const pdfPath =  join(import.meta.dirname, '../data', invoiceData.invoiceNumber + '.pdf');
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

            console.log(`PDF successfully created at: ${pdfPath}`);
        }
    }

    // Close the browser after the PDFs are generated.
    await browser.close();
}