/** Landing page. */
const en = {
  hero: {
    badge: "New",
    badgeText: "Start reading seconds after you pay",
    titleStart: "Books that teach you",
    titleAccent: "something real",
    titleEnd: ", in a reader you'll love.",
    subtitle:
      "Expert-written, practical eBooks. Pay securely in seconds, then read with realistic page turns, bookmarks and synced progress — on your phone, tablet or laptop.",
    browse: "Browse the collection",
    affiliate: "Earn as an affiliate",
    secured: "Secured by Razorpay",
    paymentMethods: "Accepted payment methods",
    methods: ["UPI", "Cards", "NetBanking", "Wallets"],
    float: {
      verified: "Payment verified",
      verifiedSub: "Added to your library",
      bookmark: "Bookmark saved",
      bookmarkSub: "Page 42",
      synced: "Synced",
      syncedSub: "Continue on any device",
      newRelease: "New on ReadnShare",
    },
    mockChapter: "Chapter 3",
    mockProgress: "p. 42 of 66 · 64%",
  },
  shelf: {
    eyebrow: "The collection",
    title: "Featured eBooks",
    subtitle: "Hand-picked, practical titles to start with.",
    viewAll: "View all eBooks",
    emptyTitle: "New books are on the way",
    emptyBody: "We're preparing our first titles. Check back soon — or join the affiliate program and be ready to share them on day one.",
    emptyCta: "Become an affiliate",
    categories: "Browse by topic",
  },
  features: {
    eyebrow: "Made for readers",
    titleStart: "Everything you need to actually",
    titleAccent: "finish",
    titleEnd: "the book",
    readerTitle: "A reader that feels like a book",
    readerBody:
      "Realistic page turns, two-page spreads on larger screens, swipe on mobile, full-screen mode and a comfortable dark theme for night reading.",
    deviceTitle: "Any device",
    deviceBody: "Phone, tablet or laptop — open your library in the browser or install the app.",
    bookmarkTitle: "Bookmarks & progress",
    bookmarkBody: "Pick up exactly where you left off, on any device.",
    paymentTitle: "Secure payments",
    paymentBody: "Razorpay-powered checkout with UPI, cards and netbanking.",
    personalTitle: "Your personal copy",
    personalBody: "Every copy is licensed to you and marked with your email, so your library stays yours.",
  },
  steps: {
    eyebrow: "How it works",
    title: "From checkout to chapter one in under a minute",
    items: [
      { title: "Choose your book", body: "Browse the collection and see the chapters and what you'll learn before you buy." },
      { title: "Pay in seconds", body: "UPI, cards, netbanking or wallets through Razorpay. No account needed upfront." },
      { title: "Start reading", body: "The book lands in your library the moment payment is verified — plus a sign-in link by email." },
    ],
  },
  app: {
    eyebrow: "ReadnShare app",
    titleStart: "Your library, one tap away —",
    titleAccent: "your way",
    body: "Install ReadnShare on your phone or computer. It opens full screen like a native app, with nothing to download from an app store.",
    points: [
      { title: "Install in one tap", body: "Works on Android, iPhone, Windows and Mac." },
      { title: "हिन्दी या English", body: "Switch the language any time from the menu." },
      { title: "Light or dark", body: "Pick a theme, or follow your device's setting." },
    ],
    install: "Install the app",
    library: "Open my library",
  },
  affiliate: {
    badge: "Affiliate program",
    titleStart: "Recommend books you love.",
    titleAccent: "Get paid",
    titleEnd: "for every sale.",
    points: [
      "A unique referral link for every eBook",
      "30-day attribution — they can buy later and you still earn",
      "Clear commission ledger and payouts to UPI or bank",
    ],
    apply: "Apply now",
    details: "Program details",
  },
  calculator: {
    title: "Estimate your monthly earnings",
    perSale: (perSale: string, sales: number) => `${perSale} per sale × ${sales} sales`,
    price: "eBook price",
    sales: "Sales per month",
    note: "Illustration at a 20% commission. Each eBook shows its own rate in your dashboard. Commission is paid on verified sales only.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered",
    items: [
      {
        q: "How do I access my eBook after buying?",
        a: "As soon as your payment is verified, the book is added to your personal library. We also email you a secure one-time sign-in link, so you can start reading even if you checked out as a guest.",
      },
      {
        q: "Do I need to create an account first?",
        a: "No. Just enter your name and email at checkout. We create your library for you, and you can set a password later from account settings.",
      },
      {
        q: "Can I download the PDF?",
        a: "Books are read in the ReadnShare reader on any device — in the browser or the installed app. Your copy is personal: every page carries your email and a copyright notice. This keeps your progress and bookmarks in sync and protects the authors' work.",
      },
      {
        q: "Can I use ReadnShare in Hindi?",
        a: "Yes. Use the language button at the top of the page to switch between English and हिन्दी. The books themselves are in the language they were written in.",
      },
      {
        q: "Which payment methods are supported?",
        a: "UPI, debit and credit cards, netbanking and popular wallets — all processed securely by Razorpay. We never see or store your card details.",
      },
      {
        q: "What if something goes wrong with my purchase?",
        a: "If you were charged twice or can't access your book, write to us with your order number and we'll fix it or refund you. See our refund policy for details.",
      },
    ],
  },
  cta: {
    titleStart: "Your next favourite book is",
    titleAccent: "one click",
    titleEnd: "away.",
    body: "Pay with UPI and start reading in seconds — no account needed.",
    button: "Explore eBooks",
  },
};

export type HomeMessages = typeof en;

const hi: HomeMessages = {
  hero: {
    badge: "नया",
    badgeText: "पेमेंट के कुछ ही सेकंड बाद पढ़ना शुरू करें",
    titleStart: "ऐसी किताबें जो सिखाएँ",
    titleAccent: "कुछ असली",
    titleEnd: ", एक ऐसे रीडर में जो आपको पसंद आएगा।",
    subtitle:
      "एक्सपर्ट्स की लिखी, काम की ई-बुक्स। कुछ सेकंड में सुरक्षित पेमेंट करें, फिर असली किताब जैसे पन्ने पलटें, बुकमार्क लगाएँ और प्रोग्रेस सिंक रखें — फ़ोन, टैबलेट या लैपटॉप पर।",
    browse: "कलेक्शन देखें",
    affiliate: "एफ़िलिएट बनकर कमाएँ",
    secured: "Razorpay से सुरक्षित",
    paymentMethods: "पेमेंट के तरीके",
    methods: ["UPI", "कार्ड", "नेटबैंकिंग", "वॉलेट"],
    float: {
      verified: "पेमेंट कन्फ़र्म",
      verifiedSub: "लाइब्रेरी में जुड़ गई",
      bookmark: "बुकमार्क सेव हुआ",
      bookmarkSub: "पेज 42",
      synced: "सिंक हो गया",
      syncedSub: "किसी भी डिवाइस पर आगे पढ़ें",
      newRelease: "ReadnShare पर नई",
    },
    mockChapter: "अध्याय 3",
    mockProgress: "पेज 42 / 66 · 64%",
  },
  shelf: {
    eyebrow: "कलेक्शन",
    title: "ख़ास ई-बुक्स",
    subtitle: "शुरुआत के लिए चुनी हुई, काम की किताबें।",
    viewAll: "सभी ई-बुक्स देखें",
    emptyTitle: "नई किताबें जल्द आ रही हैं",
    emptyBody: "हम अपनी पहली किताबें तैयार कर रहे हैं। जल्द ही दोबारा देखें — या एफ़िलिएट प्रोग्राम से जुड़ें और पहले दिन से शेयर करने के लिए तैयार रहें।",
    emptyCta: "एफ़िलिएट बनें",
    categories: "विषय के हिसाब से देखें",
  },
  features: {
    eyebrow: "पाठकों के लिए बना",
    titleStart: "किताब को सच में",
    titleAccent: "पूरा",
    titleEnd: "करने के लिए सब कुछ",
    readerTitle: "रीडर जो किताब जैसा लगे",
    readerBody:
      "असली किताब जैसे पन्ने पलटना, बड़ी स्क्रीन पर दो पेज एक साथ, मोबाइल पर स्वाइप, फ़ुल-स्क्रीन मोड और रात में पढ़ने के लिए आरामदायक डार्क थीम।",
    deviceTitle: "कोई भी डिवाइस",
    deviceBody: "फ़ोन, टैबलेट या लैपटॉप — ब्राउज़र में अपनी लाइब्रेरी खोलें या ऐप इंस्टॉल करें।",
    bookmarkTitle: "बुकमार्क और प्रोग्रेस",
    bookmarkBody: "जहाँ छोड़ा था, ठीक वहीं से आगे पढ़ें — किसी भी डिवाइस पर।",
    paymentTitle: "सुरक्षित पेमेंट",
    paymentBody: "Razorpay चेकआउट — UPI, कार्ड और नेटबैंकिंग के साथ।",
    personalTitle: "आपकी अपनी कॉपी",
    personalBody: "हर कॉपी आपके नाम लाइसेंस होती है और उस पर आपका ईमेल होता है, ताकि आपकी लाइब्रेरी सिर्फ़ आपकी रहे।",
  },
  steps: {
    eyebrow: "कैसे काम करता है",
    title: "चेकआउट से पहले अध्याय तक, एक मिनट से भी कम में",
    items: [
      { title: "किताब चुनें", body: "कलेक्शन देखें और ख़रीदने से पहले अध्याय और सीखने वाली बातें देखें।" },
      { title: "सेकंडों में पेमेंट", body: "Razorpay से UPI, कार्ड, नेटबैंकिंग या वॉलेट। पहले अकाउंट बनाने की ज़रूरत नहीं।" },
      { title: "पढ़ना शुरू करें", body: "पेमेंट कन्फ़र्म होते ही किताब आपकी लाइब्रेरी में — साथ में ईमेल पर साइन-इन लिंक भी।" },
    ],
  },
  app: {
    eyebrow: "ReadnShare ऐप",
    titleStart: "आपकी लाइब्रेरी, बस एक टैप दूर —",
    titleAccent: "आपके अंदाज़ में",
    body: "ReadnShare को अपने फ़ोन या कंप्यूटर पर इंस्टॉल करें। यह असली ऐप की तरह फ़ुल स्क्रीन खुलता है, और ऐप स्टोर से कुछ डाउनलोड नहीं करना पड़ता।",
    points: [
      { title: "एक टैप में इंस्टॉल", body: "Android, iPhone, Windows और Mac पर चलता है।" },
      { title: "हिन्दी या English", body: "मेन्यू से कभी भी भाषा बदलें।" },
      { title: "लाइट या डार्क", body: "अपनी पसंद की थीम चुनें, या डिवाइस की सेटिंग अपनाएँ।" },
    ],
    install: "ऐप इंस्टॉल करें",
    library: "मेरी लाइब्रेरी खोलें",
  },
  affiliate: {
    badge: "एफ़िलिएट प्रोग्राम",
    titleStart: "पसंद की किताबें सुझाएँ।",
    titleAccent: "हर बिक्री पर",
    titleEnd: "कमाई करें।",
    points: [
      "हर ई-बुक के लिए आपका अपना रेफ़रल लिंक",
      "30 दिन का एट्रिब्यूशन — ग्राहक बाद में ख़रीदे, तब भी आपकी कमाई",
      "साफ़ कमीशन लेजर और UPI या बैंक में पेआउट",
    ],
    apply: "अभी आवेदन करें",
    details: "प्रोग्राम की जानकारी",
  },
  calculator: {
    title: "अपनी महीने की कमाई का अंदाज़ा लगाएँ",
    perSale: (perSale: string, sales: number) => `${perSale} प्रति बिक्री × ${sales} बिक्री`,
    price: "ई-बुक की कीमत",
    sales: "हर महीने की बिक्री",
    note: "यह 20% कमीशन पर एक उदाहरण है। हर ई-बुक का अपना रेट आपके डैशबोर्ड में दिखता है। कमीशन सिर्फ़ कन्फ़र्म बिक्री पर मिलता है।",
  },
  faq: {
    eyebrow: "सवाल-जवाब",
    title: "आपके सवाल, हमारे जवाब",
    items: [
      {
        q: "ख़रीदने के बाद ई-बुक कैसे पढ़ूँ?",
        a: "पेमेंट कन्फ़र्म होते ही किताब आपकी पर्सनल लाइब्रेरी में जुड़ जाती है। हम आपको ईमेल पर एक सुरक्षित वन-टाइम साइन-इन लिंक भी भेजते हैं, ताकि गेस्ट चेकआउट के बाद भी आप तुरंत पढ़ सकें।",
      },
      {
        q: "क्या पहले अकाउंट बनाना ज़रूरी है?",
        a: "नहीं। चेकआउट पर बस अपना नाम और ईमेल डालें। आपकी लाइब्रेरी हम बना देंगे, और पासवर्ड आप बाद में अकाउंट सेटिंग्स से सेट कर सकते हैं।",
      },
      {
        q: "क्या मैं PDF डाउनलोड कर सकता हूँ?",
        a: "किताबें ReadnShare रीडर में किसी भी डिवाइस पर पढ़ी जाती हैं — ब्राउज़र में या इंस्टॉल किए ऐप में। आपकी कॉपी पर्सनल होती है: हर पेज पर आपका ईमेल और कॉपीराइट नोटिस होता है। इससे आपकी प्रोग्रेस और बुकमार्क सिंक रहते हैं और लेखकों का काम सुरक्षित रहता है।",
      },
      {
        q: "क्या ReadnShare हिन्दी में चला सकते हैं?",
        a: "हाँ। पेज के ऊपर भाषा वाले बटन से English और हिन्दी के बीच बदलें। किताबें उसी भाषा में होती हैं जिसमें वे लिखी गई हैं।",
      },
      {
        q: "पेमेंट के कौन-कौन से तरीके हैं?",
        a: "UPI, डेबिट और क्रेडिट कार्ड, नेटबैंकिंग और लोकप्रिय वॉलेट — सब Razorpay से सुरक्षित तरीके से। हम आपके कार्ड की जानकारी न देखते हैं, न सेव करते हैं।",
      },
      {
        q: "अगर ख़रीदारी में कोई दिक्कत हो तो?",
        a: "अगर पैसे दो बार कट गए या किताब नहीं खुल रही, तो अपने ऑर्डर नंबर के साथ हमें लिखें — हम ठीक करेंगे या रिफ़ंड देंगे। ज़्यादा जानकारी के लिए हमारी रिफ़ंड पॉलिसी देखें।",
      },
    ],
  },
  cta: {
    titleStart: "आपकी अगली पसंदीदा किताब बस",
    titleAccent: "एक क्लिक",
    titleEnd: "दूर है।",
    body: "UPI से पेमेंट करें और कुछ ही सेकंड में पढ़ना शुरू करें — अकाउंट की ज़रूरत नहीं।",
    button: "ई-बुक्स देखें",
  },
};

export const home = { en, hi };
