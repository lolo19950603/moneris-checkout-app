/**
 * Create a Moneris Checkout ticket
 * @param {Object} payload - The payload to send to Moneris Checkout
 * @returns {Promise<Object>} - The response from Moneris
 */
export async function createCheckoutTicket(payload) {
  try {

    const resMoneris = await fetch("https://gateway.moneris.com/chkt/request/request.php", {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify(payload)
    });
    const data = await resMoneris.json();
    const monerisResponse = data.response;
    const ticket = monerisResponse.ticket;
    return ticket;
  } catch (error) {
    console.error('Error creating Moneris ticket:', error);
    throw error;
  }
}
