// ============================================
// TELEGRAM BOT INTEGRATION
// ============================================

// Get credentials from private config
const TELEGRAM_BOT_TOKEN = CONFIG_PRIVATE.TELEGRAM.BOT_TOKEN;
const OWNER_CHAT_ID = CONFIG_PRIVATE.TELEGRAM.OWNER_CHAT_ID;
const TELEGRAM_ENABLED = CONFIG_PRIVATE.TELEGRAM.ENABLED;

// Check if Telegram is configured
if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || !TELEGRAM_ENABLED) {
    console.warn('⚠️ Telegram bot not configured. Notifications disabled.');
}

async function sendTelegramMessage(message) {
    if (!TELEGRAM_ENABLED) {
        console.log('Telegram disabled. Message:', message);
        return { ok: false, message: 'Telegram disabled' };
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: OWNER_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Telegram error:', error);
        return { ok: false, error };
    }
}

function notifyNewOrder(order) {
    if (!CONFIG_PRIVATE.TELEGRAM.NOTIFY_NEW_ORDER) return;
    
    const message = `
🔔 <b>New Order!</b>

Order ID: ${order.id}
Product: ${order.product}
Buyer: ${order.buyer}
Amount: ₱${order.amount}
Status: ${order.status}

Time: ${new Date().toLocaleString()}
    `;
    sendTelegramMessage(message);
}

function notifyLowStock(product) {
    if (!CONFIG_PRIVATE.TELEGRAM.NOTIFY_LOW_STOCK) return;
    if (product.stock > CONFIG_PRIVATE.TELEGRAM.LOW_STOCK_THRESHOLD) return;
    
    const message = `
⚠️ <b>Low Stock Alert!</b>

Product: ${product.name}
Current Stock: ${product.stock}

Please restock soon.
    `;
    sendTelegramMessage(message);
}

function notifyOrderApproved(order) {
    const message = `✅ Order ${order.id} approved and delivered!`;
    sendTelegramMessage(message);
}
