export const translations = {
  en: {
    // Navigation & Roles
    title: "Vanigam",
    admin: "Admin",
    salesman: "Salesman",
    delivery_man: "Delivery Man",
    role: "Role",
    dashboard: "Dashboard",
    route_mgmt: "Route Management",
    shop_mgmt: "Shop Management",
    product_mgmt: "Product Management",
    purchase_entry: "Purchase Entry",
    stock_ledger: "Stock Ledger",
    order_taking: "Order Taking",
    deliveries: "Deliveries",
    reports: "Reports",
    logout: "Logout",
    welcome: "Welcome",
    login: "Log In",
    username: "Username",
    password: "Password",
    switch_language: "தமிழ்",

    // Dashboard
    todays_orders: "Today's Orders",
    todays_deliveries: "Today's Deliveries",
    total_sales: "Total Sales",
    outstanding_amount: "Outstanding Amount",
    available_stock: "Available Stock",
    low_stock_alert: "Low Stock Alert",
    route_wise_orders: "Route-wise Orders",
    pending_deliveries: "Pending Deliveries",
    dashboard_summary: "Wholesale Distribution Performance Overview",

    // Route Module
    add_route: "Add Route",
    edit_route: "Edit Route",
    delete_route: "Delete Route",
    route_name_en: "Route Name (English)",
    route_name_ta: "Route Name (Tamil)",
    assign_salesman: "Assign Salesman",
    assign_delivery: "Assign Delivery Man",
    no_routes: "No routes found. Please add a route.",

    // Shop Module
    add_shop: "Add Shop",
    edit_shop: "Edit Shop",
    shop_name: "Shop Name",
    contact_person: "Contact Person",
    mobile_number: "Mobile Number",
    gst_number: "GST Number",
    address: "Address",
    shop_type: "Shop Type",
    wholesale: "Wholesale",
    retail: "Retail",
    assigned_route: "Assigned Route",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    save: "Save",
    cancel: "Cancel",

    // Product Module
    add_product: "Add Product",
    edit_product: "Edit Product",
    product_name_en: "Product Name (English)",
    product_name_ta: "Product Name (Tamil)",
    brand: "Brand",
    size: "Size",
    case_qty: "Case Quantity Rule",
    purchase_price: "Purchase Price",
    wholesale_price: "Wholesale Price",
    retail_price: "Retail Price",
    mrp: "MRP (Maximum Retail Price)",
    gst: "GST (%)",
    current_stock: "Current Stock",
    min_stock: "Minimum Stock Limit",
    out_of_stock: "Out of Stock",
    low_stock: "Low Stock",
    cases: "Cases",
    bottles: "Bottles",
    bulk_delete: "Bulk Delete",
    confirm_bulk_delete_msg: "Are you sure you want to move the selected products to the Recycle Bin? Products with sales or purchase history will be automatically skipped.",
    bulk_deleted_summary: "Successfully deleted {deleted} product(s). {skipped} product(s) skipped due to active history.",
    delete_order: "Delete Order",
    delete_order_confirm: "Are you sure you want to delete this order? All inventory stock and outstanding balances will be fully rolled back.",
    not_delivered: "Not Delivered",
    returned: "Returned",
    delivery_return: "Delivery Return",
    shop_closed: "Shop Closed",
    payment_issue: "Payment Issue",
    other: "Other",
    fulfill: "Fulfill",
    fulfillment: "Fulfillment",

    // Purchase Module
    supplier: "Supplier Name",
    purchase_date: "Purchase Date",
    enter_purchases: "Enter Stock Purchase",
    qty: "Quantity",
    submit_purchase: "Log Purchase Stock",

    // Stock Ledger
    opening_stock: "Opening Stock",
    purchased_stock: "Purchased Stock",
    sold_stock: "Sold Stock",
    ledger_type: "Type",
    ledger_running: "Running Stock",
    timestamp: "Timestamp",

    // Order Module
    select_route: "Select Route First",
    select_shop: "Select Shop",
    select_products: "Select Products",
    add_to_order: "Add to Order",
    qty_cases: "Order Cases",
    qty_bottles: "Order Bottles",
    available: "Available",
    remaining: "Remaining",
    discount: "Discount (Rs)",
    net_total: "Net Total",
    place_order: "Confirm Order & Lock Stock",
    insufficient_stock: "Cannot exceed available stock!",
    stock_remaining_label: "Stock Remaining",

    // Delivery Module
    date: "Date",
    assigned_orders: "Today's Delivery Tasks",
    mark_delivered: "Mark Delivered",
    remarks: "Remarks (optional)",
    delivery_time: "Delivery Time",
    pending: "Pending",
    delivered: "Delivered",
    payment_collection: "Collect Previous Outstanding",
    collected_amount: "Collected Amount (Rs)",
    balance_amount: "Balance Amount",
    payment_mode: "Payment Mode",
    cash: "Cash",
    gpay: "GPay",
    bank: "Bank Transfer",
    upi: "UPI",
    cheque: "Cheque",
    transaction_id: "UPI Transaction No / Reference",
    scan_pay: "Scan QR to Pay",
    split_payment: "Split Payment",
    add_payment_row: "Add Payment Mode",
    ref_number: "Reference Number",
    payment_date: "Payment Date",
    outstanding_collection: "Outstanding Collection",
    customer_ledger: "Customer Ledger",
    daily_collection_report: "Daily Collection Report",

    // Billing
    invoice: "Invoice",
    company_name: "VASANTHAM DISTRIBUTORS",
    company_address: "123, Cool Drinks Junction, Trichy Road, TN",
    company_gst: "GST: 33ABCDE1234F1Z0",
    invoice_number: "Invoice No",
    rate: "Rate",
    amount: "Amount",
    total: "Total",
    print_invoice: "Print Invoice",
    download_pdf: "Download PDF",
    share_whatsapp: "Share via WhatsApp",
    qr_payment_title: "GPAY UPI SCANNER",

    // Reports & Search
    daily_sales: "Daily Sales",
    route_sales: "Route-wise Sales",
    salesman_sales: "Salesman-wise Sales",
    collection_report: "Collection Report",
    outstanding_report: "Outstanding Report",
    stock_report: "Stock Report",
    purchase_report: "Purchase Report",
    profit_report: "Profit Report",
    search_placeholder: "Search by Shop, Route, Invoice, Mobile, Product, GST...",
    gross_profit: "Gross Profit",

    // Notifications Panel
    notifications: "Notifications",
    mark_all_read: "Mark all as read",
    no_notifications: "No notifications",

    // Alerts
    stock_refilled_msg: "{name} stock has been refilled.",
    low_stock_msg: "{name} stock is low.",
    out_of_stock_msg: "{name} is Out of Stock!",

    // Staff Access Management
    staff_mgmt: "Staff Management",
    add_user: "Create Staff Access",
    edit_user: "Edit Staff Access",
    full_name: "Full Name",
    user_status: "Access Status",
    username_exists: "Username already exists!",
    select_role: "Select Role",
    user_created_msg: "Staff access created successfully!",
    user_updated_msg: "Staff access updated successfully!",

    // Recycle Bin & Confirm Modal
    recycle_bin: "Recycle Bin",
    restore: "Restore",
    purge: "Purge",
    confirm_title: "Are you sure?",
    confirm_delete_msg: "This record will be moved to the Recycle Bin and stored for 30 days before permanent deletion.",
    confirm_cancel: "Cancel",
    confirm_ok: "Delete",

    // Vehicle Direct Sales
    vehicle_direct_sales: "Vehicle Direct Sales",
    vehicles: "Vehicles",
    vehicle_number: "Vehicle Number",
    driver_name: "Driver Name",
    add_vehicle: "Add Vehicle",
    edit_vehicle: "Edit Vehicle",
    dispatch_stock: "Dispatch Stock",
    reconcile_stock: "Reconcile Stock",
    reconcile: "Reconcile",
    select_vehicle: "Select Vehicle",
    loaded_stock: "Vehicle Loaded Stock",
    vehicle_reports: "Vehicle Reports",
    reconciliation_log: "Reconciliation Log",
    dispatches_log: "Dispatches Log",
    vehicle_wise_sales: "Vehicle-wise Sales Summary",
    returned_items: "Returned Items",
    dispatch_success: "Stock loaded onto vehicle successfully!",
    reconciliation_success: "Vehicle stock reconciled and returned to warehouse successfully!"
  },
  ta: {
    // Navigation & Roles
    title: "வணிகம்",
    admin: "நிர்வாகி (Admin)",
    salesman: "விற்பனையாளர் (Salesman)",
    delivery_man: "டெலிவரி மேன்",
    role: "பங்கு",
    dashboard: "முகப்பு பலகை",
    route_mgmt: "வழித்தட மேலாண்மை",
    shop_mgmt: "கடை மேலாண்மை",
    product_mgmt: "தயாரிப்பு மேலாண்மை",
    purchase_entry: "கொள்முதல் பதிவு",
    stock_ledger: "சரக்கு பேரேடு",
    order_taking: "ஆர்டர் எடுத்தல்",
    deliveries: "டெலிவரிகள்",
    reports: "அறிக்கைகள்",
    logout: "வெளியேறு",
    welcome: "வரவேற்கிறோம்",
    login: "உள்நுழைக",
    username: "பயனர் பெயர்",
    password: "கடவுச்சொல்",
    switch_language: "English",

    // Dashboard
    todays_orders: "இன்றைய ஆர்டர்கள்",
    todays_deliveries: "இன்றைய டெலிவரிகள்",
    total_sales: "மொத்த விற்பனை",
    outstanding_amount: "நிலுவைத் தொகை",
    available_stock: "இருக்கும் சரக்கு",
    low_stock_alert: "குறைந்த சரக்கு எச்சரிக்கை",
    route_wise_orders: "வழித்தட ஆர்டர்கள்",
    pending_deliveries: "நிலுவையில் உள்ள டெலிவரிகள்",
    dashboard_summary: "மொத்த விநியோக செயல்திறன் கண்ணோட்டம்",

    // Route Module
    add_route: "வழித்தடம் சேர்",
    edit_route: "வழித்தடம் திருத்து",
    delete_route: "வழித்தடம் நீக்கு",
    route_name_en: "வழித்தட பெயர் (ஆங்கிலம்)",
    route_name_ta: "வழித்தட பெயர் (தமிழ்)",
    assign_salesman: "விற்பனையாளரை நியமி",
    assign_delivery: "டெலிவரி மேனை நியமி",
    no_routes: "வழித்தடங்கள் இல்லை. வழித்தடத்தை சேர்க்கவும்.",

    // Shop Module
    add_shop: "கடை சேர்",
    edit_shop: "கடையை திருத்து",
    shop_name: "கடையின் பெயர்",
    contact_person: "தொடர்பு நபர்",
    mobile_number: "கைபேசி எண்",
    gst_number: "ஜிஎஸ்டி எண்",
    address: "முகவரி",
    shop_type: "கடையின் வகை",
    wholesale: "மொத்த வியாபாரம்",
    retail: "சில்லறை வியாபாரம்",
    assigned_route: "நியமிக்கப்பட்ட வழித்தடம்",
    status: "நிலை",
    active: "செயலில் உள்ளது",
    inactive: "செயலற்றது",
    save: "சேமி",
    cancel: "ரத்து செய்",

    // Product Module
    add_product: "தயாரிப்பு சேர்",
    edit_product: "தயாரிப்பு திருத்து",
    product_name_en: "தயாரிப்பு பெயர் (ஆங்கிலம்)",
    product_name_ta: "தயாரிப்பு பெயர் (தமிழ்)",
    brand: "பிராண்ட்",
    size: "அளவு",
    case_qty: "கேஸ் அளவு விதி",
    purchase_price: "கொள்முதல் விலை",
    wholesale_price: "மொத்த விற்பனை விலை",
    retail_price: "சில்லறை விற்பனை விலை",
    mrp: "அதிகபட்ச சில்லறை விலை (MRP)",
    gst: "ஜிஎஸ்டி (GST %)",
    current_stock: "தற்போதைய இருப்பு",
    min_stock: "குறைந்தபட்ச இருப்பு வரம்பு",
    out_of_stock: "கையிருப்பு இல்லை",
    low_stock: "சரக்கு குறைவு",
    cases: "கேஸ்கள்",
    bottles: "பாட்டில்கள்",
    bulk_delete: "மொத்தமாக நீக்கு",
    confirm_bulk_delete_msg: "தேர்ந்தெடுக்கப்பட்ட தயாரிப்புகளை குப்பைத் தொட்டிக்கு நகர்த்த விரும்புகிறீர்களா? விற்பனை அல்லது கொள்முதல் வரலாறு கொண்ட தயாரிப்புகள் தானாகவே தவிர்க்கப்படும்.",
    bulk_deleted_summary: "வெற்றிகரமாக {deleted} தயாரிப்புகள் நீக்கப்பட்டன. செயலில் உள்ள வரலாற்று பதிவுகள் காரணமாக {skipped} தயாரிப்புகள் தவிர்க்கப்பட்டன.",
    delete_order: "ஆர்டரை நீக்கு",
    delete_order_confirm: "இந்த ஆர்டரை நீக்க உறுதியாகவா? அனைத்து சரக்குகள் மற்றும் நிலுவைத் தொகைகள் திரும்பப் பெறப்படும்.",
    not_delivered: "விநியோகிக்கப்படவில்லை",
    returned: "திரும்பப் பெறப்பட்டது",
    delivery_return: "விநியோகம் திரும்புதல்",
    shop_closed: "கடை மூடப்பட்டுள்ளது",
    payment_issue: "பணம் செலுத்துவதில் சிக்கல்",
    other: "மற்றவை",
    fulfill: "நிறைவேற்று",
    fulfillment: "நிறைவேற்றம்",

    // Purchase Module
    supplier: "விநியோகஸ்தர் பெயர்",
    purchase_date: "கொள்முதல் தேதி",
    enter_purchases: "சரக்கு கொள்முதல் உள்ளீடு",
    qty: "அளவு",
    submit_purchase: "கொள்முதல் பதிவை சேமி",

    // Stock Ledger
    opening_stock: "துவக்க இருப்பு",
    purchased_stock: "கொள்முதல் இருப்பு",
    sold_stock: "விற்பனையான இருப்பு",
    ledger_type: "வகை",
    ledger_running: "நடப்பு சரக்கு",
    timestamp: "நேரம்",

    // Order Module
    select_route: "முதலில் வழித்தடத்தை தேர்வு செய்யவும்",
    select_shop: "கடையை தேர்வு செய்க",
    select_products: "தயாரிப்புகளை தேர்வு செய்க",
    add_to_order: "ஆர்டரில் சேர்",
    qty_cases: "ஆர்டர் கேஸ்கள்",
    qty_bottles: "ஆர்டர் பாட்டில்கள்",
    available: "கையிருப்பில்",
    remaining: "மீதமுள்ள இருப்பு",
    discount: "தள்ளுபடி (ரூ)",
    net_total: "மொத்த தொகை",
    place_order: "ஆர்டரை உறுதி செய்து இருப்பை லாக் செய்க",
    insufficient_stock: "இருப்பை விட அதிகமாக ஆர்டர் செய்ய முடியாது!",
    stock_remaining_label: "மீதமுள்ள சரக்கு",

    // Delivery Module
    date: "தேதி",
    assigned_orders: "இன்றைய விநியோகப் பணிகள்",
    mark_delivered: "விநியோகிக்கப்பட்டது",
    remarks: "குறிப்புகள் (தேவைப்பட்டால்)",
    delivery_time: "விநியோக நேரம்",
    pending: "நிலுவையில் உள்ளது",
    delivered: "வழங்கப்பட்டது",
    payment_collection: "முந்தைய நிலுவைத் தொகையை வசூலி",
    collected_amount: "வசூலிக்கப்பட்ட தொகை (ரூ)",
    balance_amount: "மீதித் தொகை",
    payment_mode: "செலுத்தும் முறை",
    cash: "ரொக்கம்",
    gpay: "ஜிபே (GPay)",
    bank: "வங்கி பரிமாற்றம்",
    upi: "யுபிஐ (UPI)",
    cheque: "காசோலை (Cheque)",
    transaction_id: "UPI பரிவர்த்தனை எண் / குறிப்பு",
    scan_pay: "QR ஸ்கேன் செய்து பணம் செலுத்தவும்",
    split_payment: "பிரிப்பு கட்டணம் (Split Payment)",
    add_payment_row: "செலுத்தும் முறை சேர்க்கவும்",
    ref_number: "குறிப்பு எண்",
    payment_date: "செலுத்தப்பட்ட தேதி",
    outstanding_collection: "நிலுவை வசூல்",
    customer_ledger: "வாடிக்கையாளர் பேரேடு",
    daily_collection_report: "தினசரி வசூல் அறிக்கை",

    // Billing
    invoice: "விலைப்பட்டியல் (Invoice)",
    company_name: "வசந்தம் விநியோகஸ்தர்கள்",
    company_address: "123, கூல் டிரிங்க்ஸ் சந்திப்பு, திருச்சி சாலை, தமிழ்நாடு",
    company_gst: "ஜிஎஸ்டி: 33ABCDE1234F1Z0",
    invoice_number: "விலைப்பட்டியல் எண்",
    rate: "விலை",
    amount: "தொகை",
    total: "கூடுதல்",
    print_invoice: "பில் அச்சிடு",
    download_pdf: "PDF பதிவிறக்கு",
    share_whatsapp: "வாட்ஸ்அப்பில் பகிர்க",
    qr_payment_title: "ஜிபே UPI ஸ்கேனர்",

    // Reports & Search
    daily_sales: "தினசரி விற்பனை",
    route_sales: "வழித்தட விற்பனை",
    salesman_sales: "விற்பனையாளர் விற்பனை",
    collection_report: "வசூல் அறிக்கை",
    outstanding_report: "நிலுவை அறிக்கை",
    stock_report: "சரக்கு அறிக்கை",
    purchase_report: "கொள்முதல் அறிக்கை",
    profit_report: "லாப அறிக்கை",
    search_placeholder: "கடை, வழித்தடம், பில் எண், மொபைல், தயாரிப்பு, ஜிஎஸ்டி மூலம் தேடு...",
    gross_profit: "மொத்த லாபம்",

    // Notifications Panel
    notifications: "அறிவிப்புகள்",
    mark_all_read: "அனைத்தையும் படித்ததாக குறிக்கவும்",
    no_notifications: "அறிவிப்புகள் எதுவும் இல்லை",

    // Alerts
    stock_refilled_msg: "{name} இருப்பு நிரப்பப்பட்டது.",
    low_stock_msg: "{name} இருப்பு குறைவாக உள்ளது.",
    out_of_stock_msg: "{name} இருப்பு இல்லை!",

    // Staff Access Management
    staff_mgmt: "பணியாளர் மேலாண்மை",
    add_user: "பணியாளர் அணுகலை உருவாக்கு",
    edit_user: "பயனர் அணுகலைத் திருத்து",
    full_name: "முழு பெயர்",
    user_status: "அணுகல் நிலை",
    username_exists: "பயனர் பெயர் ஏற்கனவே உள்ளது!",
    select_role: "பங்கு தேர்வு செய்க",
    user_created_msg: "அணுகல் வெற்றிகரமாக உருவாக்கப்பட்டது!",
    user_updated_msg: "அணுகல் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!",

    // Recycle Bin & Confirm Modal
    recycle_bin: "குப்பைத் தொட்டி (Recycle Bin)",
    restore: "மீட்டமை",
    purge: "நிரந்தரமாக நீக்கு",
    confirm_title: "உறுதியாகவா?",
    confirm_delete_msg: "இந்தத் தரவு குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டு, நிரந்தரமாக நீக்கப்படுவதற்கு முன்பு 30 நாட்களுக்கு சேமிக்கப்படும்.",
    confirm_cancel: "ரத்து செய்",
    confirm_ok: "நீக்கு",

    // Vehicle Direct Sales
    vehicle_direct_sales: "வாகன நேரடி விற்பனை",
    vehicles: "வாகனங்கள்",
    vehicle_number: "வாகன எண்",
    driver_name: "ஓட்டுநர் பெயர்",
    add_vehicle: "வாகனம் சேர்",
    edit_vehicle: "வாகனம் திருத்து",
    dispatch_stock: "சரக்கு ஏற்றுதல்",
    reconcile_stock: "சரக்கு சமரசம்",
    reconcile: "சமரசம் செய்க",
    select_vehicle: "வாகனத்தைத் தேர்ந்தெடுக்கவும்",
    loaded_stock: "வாகனத்தில் உள்ள சரக்கு",
    vehicle_reports: "வாகன அறிக்கைகள்",
    reconciliation_log: "சமரசம் பதிவுகள்",
    dispatches_log: "ஏற்றப்பட்ட பதிவுகள்",
    vehicle_wise_sales: "வாகன விற்பனை சுருக்கம்",
    returned_items: "திரும்பப் பெற்றவை",
    dispatch_success: "சரக்கு வெற்றிகரமாக வாகனத்தில் ஏற்றப்பட்டது!",
    reconciliation_success: "சரக்கு வெற்றிகரமாக சமரசம் செய்யப்பட்டு கிடங்கிற்கு மாற்றப்பட்டது!"
  }
};

export const translateShopName = (shop, lang) => {
  if (!shop) return '';
  const nameEn = shop.name_en || shop.name || '';
  const nameTa = shop.name_ta || '';
  
  if (lang === 'ta') {
    const trimmedEn = nameEn.trim();
    const dictionary = {
      "Pavithra": "பவித்ரா",
      "M.R.K": "எம்.ஆர்.கே",
      "MRK": "எம்.ஆர்.கே",
      "Sri Balaji": "ஸ்ரீ பாலாஜி",
      "Balaji": "பாலாஜி",
      "Krishna": "கிருஷ்ணா",
      "Renukambal": "ரேணுகாம்பாள்",
      "Dhanalakshmi": "தனலட்சுமி",
      "Ponniy": "பொன்னி",
      "Jayapal": "ஜெயபால்",
      "Pacha": "பச்சை",
      "Sri": "ஸ்ரீ",
      "J.S.S.": "ஜே.எஸ்.எஸ்.",
      "JSS": "ஜே.எஸ்.எஸ்.",
      "Kohinoor": "கோஹினூர்",
      "Rafik Maligai": "ரஃபிக் மளிகை",
      "Tamil Nadu": "தமிழ்நாடு",
      "Jana": "ஜனா",
      "Elumalai Tea Stall": "எழுமலை டீ ஸ்டால்",
      "Rajesh Bakery": "ராஜேஷ் பேக்கரி",
      "Sai Cool Drinks": "சாய் கூல் ட்ரிங்க்ஸ்",
      "Ashok Sweets": "அசோக் ஸ்வீட்ஸ்",
      "Shanmuga Fruit Stall": "சண்முகா புரூட் ஸ்டால்",
      "R.R.K. Pattu": "ஆர்.ஆர்.கே. பட்டு",
      "Sri Ram Fruit Stall": "ஸ்ரீ ராம் புரூட் ஸ்டால்",
      "Vijay Bunk": "விஜய் பங்க்",
      "Venkateswara Bunk": "வெங்கடேஸ்வரா பங்க்",
      "K.K.N": "கே.கே.என்",
      "Aavin Milk Depot": "ஆவின் பால் டெப்போ",
      "Aishwarya Bhavan": "ஐஸ்வர்யா பவன்",
      "Imported Shop 1": "இறக்குமதி செய்யப்பட்ட கடை 1",
      "Imported Shop 2": "இறக்குமதி செய்யப்பட்ட கடை 2",
      "Vishnu Enterprise": "விஷ்ணு எண்டர்பிரைஸ்",
      "Murugan Store": "முருகன் ஸ்டோர்",
      "Periyandavar Store": "பெரியாண்டவர் ஸ்டோர்",
      "Pugazh": "புகழ்",
      "Ganesh": "கணேஷ்",
      "Mahalakshmi": "மகாலட்சுமி",
      "K.P.M": "கே.பி.எம்",
      "Thangamani": "தங்கமணி",
      "Muthu Maligai": "முத்து மளிகை",
      "Amma Tea Time": "அம்மா டீ டைம்",
      "Suji Cafe": "சுஜி கஃபே",
      "Siva Sakthi Store": "சிவசக்தி ஸ்டோர்",
      "Sri Mahalakshmi Bakery": "ஸ்ரீ மகாலட்சுமி பேக்கரி",
      "Arumugam Store": "ஆறுமுகம் ஸ்டோர்",
      "Elumalai": "எழுமலை",
      "Gandhi": "காந்தி",
      "Sriram": "ஸ்ரீராம்",
      "Sri Ram": "ஸ்ரீ ராம்",
      "Periysamy": "பெரியசாமி",
      "Radhakrishnan": "ராதாகிருஷ்ணன்",
      "J K": "ஜே கே",
      "Sasi Store": "சசி ஸ்டோர்",
      "Sasi": "சசி",
      "Sivakumar Maligai": "சிவகுமார் மளிகை",
      "Sivakumar": "சிவகுமார்",
      "Mani Maligai": "மணி மளிகை",
      "Mani": "மணி",
      "Sharmila": "ஷர்மிலா",
      "Ammaiyappan": "அம்மையப்பன்",
      "Amsavalli Malligai": "அம்சவல்லி மளிகை",
      "Amsavalli": "அம்சவல்லி",
      "Subramani Sharmila": "சுப்பிரமணி ஷர்மிலா",
      "Subramani": "சுப்பிரமணி",
      "Relax Time": "ரிலாக்ஸ் டைம்",
      "Relax": "ரிலாக்ஸ்",
      "Time": "டைம்",
      "Akash": "ஆகாஷ்",
      "Vallalar": "வள்ளலார்",
      "Saravanan": "சரவணன்",
      "Saravana": "சரவணா",
      "Murugan": "முருகன்",
      "Vennila": "வெண்ணிலா",
      "Vasanthan": "வசந்தன்",
      "Dhanush": "தனுஷ்",
      "Oil": "ஆயில்",
      "M.M.M.": "எம்.எம்.எம்.",
      "Kandhan": "கந்தன்",
      "Munees": "முனீஸ்",
      "Mageshwari": "மகேஸ்வரி",
      "Valar": "வளர்",
      "New": "நியூ",
      "Archana": "அர்ச்சனா",
      "Rafik": "ரஃபிக்",
      "Rajesh": "ராஜேஷ்",
      "Sai": "சாய்",
      "Ashok": "அசோக்",
      "Shanmuga": "சண்முகா",
      "Vijay": "விஜய்",
      "Venkateswara": "வெங்கடேஸ்வரா",
      "Murugesan": "முருகேசன்",
      "Mayilam": "மயிலம்",
      "Riyash": "ரியாஸ்",
      "Sivasakthi": "சிவசக்தி",
      "Sekar": "சேகர்" ,
      "Kumar": "குமார்",
      "Senthoor": "செந்தூர்",
      "AVS": "ஏவிஎஸ்",
      "Janakiraman": "ஜானகிராமன்",
      "Iyappan": "ஐயப்பன்",
      "Ramajeyam": "ராமஜெயம்",
      "Saradha": "சாரதா",
      "Tea Town": "டீ டவுன்",
      "A2K": "ஏ2கே",
      "Kaliyadas": "காளியதாஸ்",
      "Garden": "கார்டன்",
      "Karuppatti": "கருப்பட்டி",
      "S.M.T": "எஸ்.எம்.டி",
      "Ragini": "ராகிணி",
      "Anandha": "ஆனந்தா",
      "Three Star": "த்ரீ ஸ்டார்",
      "SST": "எஸ்எஸ்டி",
      "Dhaba": "தாபா",
      "Ganapathi": "கணபதி",
      "Ganapathy": "கணபதி",
      "Siva": "சிவா",
      "Sakthi": "சக்தி",
      "G.K.P": "ஜி.கே.பி",
      "Sumathi": "சுமதி",
      "V.B.R": "வி.பி.ஆர்",
      "A1": "ஏ1",
      "Iyengar": "ஐயங்கார்",
      "V.A.P": "வி.ஏ.பி",
      "Nivee": "நிவி",
      "ABT": "ஏபிடி" ,
      "S.K": "எஸ்.கே",
      "M.S.R": "எம்.எஸ்.ஆர்",
      "Annapoorna": "அன்னபூர்ணா",
      "Kishore": "கிஷோர்",
      "Sudharsan": "சுதர்சன்",
      "Parvathiyammal": "பார்வதியம்மாள்",
      "T.K.S": "டி.கே.எஸ்",
      "Nanban": "நண்பன்",
      "M.G.": "எம்.ஜி.",
      "Arun": "அருண்",
      "Vigneswaran": "விக்னேஸ்வரன்",
      "A.V.M": "ஏ.வி.எம்",
      "Sakthivel": "சக்திவேல்",
      "K.K.C.R": "கே.கே.சி.ஆர்",
      "Magi": "மகி",
      "Revathi": "ரேவதி",
      "R. S": "ஆர். எஸ்",
      "Pranaviga": "பிரணவிகா",
      "Muthu": "முத்து",
      "K.R.V.S": "கே.ஆர்.வி.எஸ்",
      "G.V.R": "ஜி.வி.ஆர்",
      "Vengadesan": "வெங்கடேசன்",
      "V.K.": "வி.கே.",
      "Eswaran": "ஈஸ்வரன்",
      "R.K.": "ஆர்.கே.",
      "Jaya Surya": "ஜெய சூர்யா",
      "Mohan": "மோகன்",
      "Tea World": "டீ வேர்ல்ட்",
      "K.P.S": "கே.பி.எஸ்",
      "Amman": "அம்மன்",
      "S.S.R": "எஸ்.எஸ்.ஆர்",
      "Sai Xerox": "சாய் ஜெராக்ஸ்",
      "AKT": "ஏகேடி",
      "Thalapathy": "தளபதி",
      "A2A": "ஏ2ஏ",
      "Nivi": "நிவி",
      "Ezhumalai": "எழுமலை",
      "Vada Pathrakaliyamman": "வட பத்ரகாளியம்மன்",
      "Friends": "பிரெண்ட்ஸ்",
      "Annamalaiyar": "அண்ணாமலையார்",
      "Dilibabu": "திலிப்பபு",
      "K.S": "கே.எஸ்",
      "Hall Girl": "ஹால் கேர்ள்",
      "K.A.S": "கே.ஏ.எஸ்",
      "K.S.M": "கே.எஸ்.எம்",
      "Prakash": "பிரகாஷ்",
      "Kandha": "கந்தா",
      "Paappaathi": "பாப்பாத்தி",
      "Amirtha": "அமிர்தா",
      "Spot": "ஸ்பாட்",
      "Gokul": "கோகுல்",
      "Kumbakonam": "கும்பகோணம்",
      "Degree": "டிகிரி",
      "Guna": "குணா",
      "Day": "டே",
      "Arabian": "அரேபியன்",
      "Highway": "ஹைவே",
      "Nest": "நெஸ்ட்",
      "Mini": "மினி",
      "Juice": "ஜூஸ்",
      "Land": "லேண்ட்",
      "Gees": "கீஸ்",
      "Akka": "அக்கா",
      "Kannal": "கண்ணல்",
      "Owner": "உரிமையாளர்",
      "Raja": "ராஜா",
      "Paradise": "பேரடைஸ்",
      "Food": "புட்",
      "Seelan": "சீலன்",
      "Appu": "அப்பு" ,
      "Imran": "இம்ரான்",
      "Srinivasan": "சீனிவாசன்",
      "A-D": "ஏ-டி",
      "S.M.K": "எஸ்.எம்.கே.",
      "Basira": "பசிரா",
      "Dosth": "தோஸ்த்",
      "Tharuman": "தருமன்",
      "Devaguru": "தேவகுரு",
      "Kathirvel": "கதிர்வேல்",
      "India": "இந்தியா",
      "Ilango": "இளங்கோ",
      "Kavi": "கவி",
      "Bharathi": "பாரதி",
      "Chendur": "செந்தூர்",
      "Lokesh": "லோகேஷ்",
      "Bakkery": "பேக்கரி",
      "Sweet": "ஸ்வீட்",
      "Stall": "ஸ்டால்",
      "Bakkiyalakshmi": "பாக்கியலட்சுமி",
      "Nadar": "நாடார்",
      "DK": "டிகே",
      "Kamal": "கமல்",
      "Muneeswaran": "முனீஸ்வரன்",
      "Panneer": "பன்னீர்",
      "Ramamoorthy": "ராமமூர்த்தி",
      "Sakunthala": "சகுந்தலா",
      "Krishnan": "கிருஷ்ணன்",
      "Tea": "டீ",
      "Kumar": "குமார்",
      "Suba": "சுபா",
      "Kamu": "காமு",
      "J.P": "ஜே.பி",
      "K. J": "கே.ஜே",
      "Back": "பேக்",
      "Mens": "மென்ஸ்",
      "Brush": "பிரஷ்",
      "GSK": "ஜிஎஸ்கே",
      "sivn temple rode": "சிவன் கோவில் சவாரி",
      "sivn temple": "சிவன் கோவில்",
      "Store": "ஸ்டோர்",
      "Maligai": "மளிகை",
      "Malligai": "மளிகை",
      "Cafe": "கஃபே",
      "Café": "கஃபே",
      "Bakery": "பேக்கரி",
      "Tea Time": "டீ டைம்",
      "Enterprise": "எண்டர்பிரைஸ்",
      "Bunk": "பங்க்",
      "Fruit Stall": "புரூட் ஸ்டால்",
      "Fruits": "பழங்கள்",
      "Tea Stall": "டீ ஸ்டால்",
      "Sweets": "ஸ்வீட்ஸ்",
      "Bhavan": "பவன்",
      "Depot": "டெப்போ",
      "Milk Depot": "பால் டெப்போ",
      "National Highway": "தேசிய நெடுஞ்சாலை",
      "Route": "வழி",
      "Super Market": "சூப்பர் மார்க்கெட்",
      "Supermarket": "சூப்பர் மார்க்கெட்",
      "Pazhamudhir Solai": "பழமுதிர் சோலை",
      "Mini bajar": "மினி பஜார்",
      "Guest House": "கெஸ்ட் ஹவுஸ்",
      "Food Court": "புட் கோர்ட்",
      "Vilas": "விலாஸ்",
      "Hotel": "ஹோட்டல்",
      "Degree Coffee": "டிகிரி காபி",
      "Coffee": "காபி",
      "Cool Drinks": "கூல் ட்ரிங்க்ஸ்",
      "Sweet Stall": "ஸ்வீட் ஸ்டால்",
      "Plastic": "பிளாஸ்டிக்",
      "Water": "தண்ணீர்",
      "Gidangal": "கிடங்கு"
    };
    if (dictionary[trimmedEn]) {
      return dictionary[trimmedEn];
    }
    if (nameTa && nameTa.trim() !== nameEn.trim()) {
      return nameTa;
    }
    let translated = nameEn;
    Object.keys(dictionary)
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
      });
    if (translated !== nameEn) return translated;

    return nameTa || nameEn;
  }
  return nameEn;
};

export const translateRouteName = (route, lang) => {
  if (!route) return '';
  const nameEn = route.name_en || route.name || '';
  const nameTa = route.name_ta || '';
  
  if (lang === 'ta') {
    const trimmedEn = nameEn.trim();
    const dictionary = {
      "Chennai National Highway Route": "சென்னை தேசிய நெடுஞ்சாலை பாதை",
      "Chennai National Highway": "சென்னை தேசிய நெடுஞ்சாலை",
      "Tindivanam Route": "திண்டிவனம் வழி",
      "Villupuram Route": "விழுப்புரம் வழி",
      "Pondicherry Route": "பாண்டிச்சேரி வழி",
      "Devanur Route": "தேவனூர் பாதை",
      "Devanur Path": "தேவனூர் பாதை",
      "Devanur": "தேவனூர்",
      "Devanoor Route": "தேவனூர் பாதை",
      "Kootteripattu Route": "கூட்டேரிப்பட்டு வழி",
      "Kootteripattu Path": "கூட்டேரிப்பட்டு பாதை",
      "Kootteripattu": "கூட்டேரிப்பட்டு",
      "Kooteripattu": "கூட்டேரிப்பட்டு",
      "Vellimedupettai Route": "வெள்ளிமேடுபேட்டை பாதை",
      "Vellimedupettai": "வெள்ளிமேடுபேட்டை",
      "Local Route": "உள்ளூர் வழி",
      "Local": "உள்ளூர்",
      "Pondy Road Route": "பாண்டி சாலை வழி",
      "Pondy Road": "பாண்டி சாலை",
      "Path": "பாதை",
      "Route": "வழி",
      "Road": "சாலை",
      "Way": "வழி"
    };
    if (dictionary[trimmedEn]) {
      return dictionary[trimmedEn];
    }
    if (nameTa && nameTa.trim() !== nameEn.trim()) {
      return nameTa;
    }
    let translated = nameEn;
    Object.keys(dictionary)
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
      });
    if (translated !== nameEn) return translated;
    
    return nameTa || nameEn;
  }
  return nameEn;
};

export function sanitizeTamilBeverageTerms(text) {
  if (!text) return '';
  let result = text;
  result = result.replace(/7\s*வரை/gi, "7 அப்");
  result = result.replace(/7\s*up/gi, "7 அப்");
  result = result.replace(/7up/gi, "7 அப்");
  result = result.replace(/மாம்பழத்/g, "மேங்கோ ");
  result = result.replace(/மாம்பழம்/g, "மேங்கோ");
  result = result.replace(/மாம்பழ/g, "மேங்கோ");
  result = result.replace(/பச்சை/g, "க்ரீன்");
  result = result.replace(/புல்பி|கூழ்/gi, "பல்பி");
  result = result.replace(/எலுமிச்சை/g, "லெமன்");
  return result;
}

export const translateProductName = (prod, lang) => {
  if (!prod) return '';
  const nameEn = prod.name_en || prod.name || '';
  let nameTa = prod.name_ta || '';
  
  if (lang === 'ta') {
    if (nameTa) {
      nameTa = sanitizeTamilBeverageTerms(nameTa);
    }
    if (nameTa && nameTa.trim() !== nameEn.trim() && !/[a-zA-Z]/.test(nameTa)) {
      return nameTa;
    }

    const trimmedEn = nameEn.trim();
    const dictionary = {
      "Mountain Dew": "மவுண்டன் டியூ",
      "Coca-Cola": "கோகோ கோலா",
      "Coca Cola": "கோகோ கோலா",
      "Coke": "கோகோ கோலா",
      "Frooti": "ஃப்ரூட்டி",
      "ஃப்ரூட்டி": "ஃப்ரூட்டி",
      "A. Apple": "ஏ. ஆப்பிள்",
      "Apple": "ஆப்பிள்",
      "B. Fizzi": "பி. ஃபிஸி",
      "Fizzi": "ஃபிஸி",
      "Smoodh": "ஸ்மூத்",
      "7 Up": "7 அப்",
      "7up": "7 அப்",
      "Pepsi": "பெப்சி",
      "Mirinda": "மிரிண்டா",
      "Slice": "ஸ்லைஸ்",
      "Maaza": "மாசா",
      "Sprite": "ஸ்ப்ரைட்",
      "Thums Up": "தம்ஸ் அப்",
      "Fanta": "ஃபாண்டா",
      "Limca": "லிம்கா",
      "Bovonto": "போவோண்டோ",
      "Torino": "டோரினோ",
      "Jeera": "ஜீரக்",
      "Bisleri": "பிஸ்லேரி",
      "Mango": "மேங்கோ",
      "Green": "க்ரீன்",
      "Pulpy Orange": "பல்பி ஆரஞ்சு",
      "Pulpi Orange": "பல்பி ஆரஞ்சு",
      "Pulpy": "பல்பி",
      "Pulpi": "பல்பி",
      "Lemon": "லெமன்",
      "Lime": "லைம்",
      "Minute Maid": "மினிட் மேட்",
      "Red Bull": "ரெட் புல்",
      "Sting": "ஸ்டிங்"
    };
    if (dictionary[trimmedEn]) {
      return dictionary[trimmedEn];
    }
    let translated = nameEn;
    Object.keys(dictionary)
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
      });
    translated = sanitizeTamilBeverageTerms(translated);
    if (translated !== nameEn) return translated;
    
    return (nameTa && !/[a-zA-Z]/.test(nameTa)) ? nameTa : nameEn;
  }
  return nameEn;
};

export const translateAddress = (address, lang) => {
  if (!address) return '';
  if (lang === 'ta') {
    const trimmed = address.trim();
    const dictionary = {
      "CHENNAI HIGHWAY": "சென்னை நெடுஞ்சாலை",
      "Chennai Highway": "சென்னை நெடுஞ்சாலை",
      "Tindivanam": "திண்டிவனம்",
      "Villupuram": "விழுப்புரம்",
      "Pondicherry": "பாண்டிச்சேரி",
      "Devanur": "தேவனூர்",
      "Kootteripattu": "கூட்டேரிப்பட்டு",
      "Vellimedupettai": "வெள்ளிமேடுபேட்டை",
      "National Highway": "தேசிய நெடுஞ்சாலை",
      "Highway": "நெடுஞ்சாலை",
      "Road": "சாலை",
      "Street": "தெரு",
      "N/A": "N/A"
    };
    if (dictionary[trimmed]) {
      return dictionary[trimmed];
    }
    
    let translated = trimmed;
    Object.keys(dictionary)
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
      });
    return translated;
  }
  return address;
};

