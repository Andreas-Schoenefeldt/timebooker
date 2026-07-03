/**
 *
 * @param {DateTime} start
 * @param {DateTime} end
 * @returns {Promise<number>}
 */
export async function getAverageUsdToEur(start, end) {
    try {
        const res = await fetch(`https://api.frankfurter.dev/v2/rates?from=${start.toISODate()}&to=${end.toISODate()}&base=USD&quotes=EUR&group=month`);
        const data = await res.json();

        return Math.round(data[0].rate * 100) / 100;
    } catch (e) {
        console.error(e);
        // fallback USD -> EUR
        return 0.85;
    }
}