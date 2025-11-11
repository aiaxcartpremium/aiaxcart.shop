// Order Management Functions

function createOrder(product, buyer, amount) {
    const order = {
        id: 'ORD' + Date.now(),
        product: product,
        buyer: buyer,
        amount: amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        deliveryDetails: null
    };
    
    // Save to database
    console.log('Creating order:', order);
    
    // Send notification to owner (Telegram)
    notifyOwner(order);
    
    return order;
}

function approveOrder(orderId) {
    console.log('Approving order:', orderId);
    // Update status to 'approved'
    // Assign inventory item
    // Send delivery details to buyer
    return true;
}

function deliverOrder(orderId, accountDetails) {
    const delivery = {
        orderId: orderId,
        accountEmail: accountDetails.email,
        accountPassword: accountDetails.password,
        profile: accountDetails.profile || 'N/A',
        pin: accountDetails.pin || 'N/A',
        expiryDate: calculateExpiry(accountDetails.duration),
        deliveredAt: new Date().toISOString()
    };
    
    console.log('Delivering order:', delivery);
    return delivery;
}

function calculateExpiry(duration) {
    const months = parseInt(duration);
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    return expiry.toLocaleDateString();
}

function notifyOwner(order) {
    console.log('📱 Telegram notification sent to owner:', order);
    // Integrate with telegram-bot.js
}
