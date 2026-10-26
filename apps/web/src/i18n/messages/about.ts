/** About Us page. */
const en = {
  metaTitle: "About us",
  metaDescription: "ReadnShare is an Indian store for practical eBooks you can read instantly in a secure online reader.",
  eyebrow: "About us",
  titleStart: "Practical books,",
  titleAccent: "read beautifully",
  subtitle:
    "ReadnShare is an online store for practical, expert-written eBooks. Buy securely in Indian Rupees and start reading in seconds in a reader made for phones, tablets and computers.",
  whatTitle: "What we do",
  whatBody:
    "We sell digital eBooks on useful, real-world topics. Every book is read online in the ReadnShare reader — with realistic page turns, bookmarks and progress that syncs across your devices.",
  offerTitle: "What you get",
  offer: [
    { title: "Digital eBooks", body: "Delivered instantly to your online library after payment. Nothing is shipped." },
    { title: "Know before you buy", body: "See each book's chapters and what you'll learn before you pay." },
    { title: "Secure payments", body: "UPI, cards, netbanking and wallets through Razorpay, in Indian Rupees." },
    { title: "Your personal copy", body: "Each copy is licensed to you and marked with your email, which protects authors' work." },
  ],
  partnersTitle: "For creators and promoters",
  partnersBody:
    "Our affiliate program lets bloggers, creators and communities recommend books they like and earn a commission on every verified sale.",
  partnersCta: "About the affiliate program",
  operatedBy: (name: string) => `ReadnShare is operated by ${name}.`,
  contactTitle: "Get in touch",
  contactBody: "Questions, feedback or help with an order — we'd love to hear from you.",
  contactCta: "Contact us",
  browseCta: "Browse eBooks",
};

export type AboutMessages = typeof en;

const hi: AboutMessages = {
  metaTitle: "हमारे बारे में",
  metaDescription: "ReadnShare काम की ई-बुक्स का भारतीय स्टोर है, जिन्हें आप सुरक्षित ऑनलाइन रीडर में तुरंत पढ़ सकते हैं।",
  eyebrow: "हमारे बारे में",
  titleStart: "काम की किताबें,",
  titleAccent: "पढ़ने का शानदार अनुभव",
  subtitle:
    "ReadnShare काम की, एक्सपर्ट्स की लिखी ई-बुक्स का ऑनलाइन स्टोर है। भारतीय रुपये में सुरक्षित तरीके से ख़रीदें और फ़ोन, टैबलेट या कंप्यूटर के लिए बने रीडर में कुछ ही सेकंड में पढ़ना शुरू करें।",
  whatTitle: "हम क्या करते हैं",
  whatBody:
    "हम काम के, असल ज़िंदगी से जुड़े विषयों पर डिजिटल ई-बुक्स बेचते हैं। हर किताब ReadnShare रीडर में ऑनलाइन पढ़ी जाती है — असली किताब जैसे पन्ने पलटना, बुकमार्क और हर डिवाइस पर सिंक होने वाली प्रोग्रेस के साथ।",
  offerTitle: "आपको क्या मिलता है",
  offer: [
    { title: "डिजिटल ई-बुक्स", body: "पेमेंट के बाद तुरंत आपकी ऑनलाइन लाइब्रेरी में। कुछ भी शिप नहीं होता।" },
    { title: "ख़रीदने से पहले जानें", body: "पेमेंट से पहले हर किताब के अध्याय और सीखने वाली बातें देखें।" },
    { title: "सुरक्षित पेमेंट", body: "Razorpay से UPI, कार्ड, नेटबैंकिंग और वॉलेट — भारतीय रुपये में।" },
    { title: "आपकी अपनी कॉपी", body: "हर कॉपी आपके नाम लाइसेंस होती है और उस पर आपका ईमेल होता है, जिससे लेखकों का काम सुरक्षित रहता है।" },
  ],
  partnersTitle: "क्रिएटर्स और प्रमोटर्स के लिए",
  partnersBody: "हमारे एफ़िलिएट प्रोग्राम से ब्लॉगर, क्रिएटर और कम्युनिटी अपनी पसंद की किताबें सुझा सकते हैं और हर कन्फ़र्म बिक्री पर कमीशन कमा सकते हैं।",
  partnersCta: "एफ़िलिएट प्रोग्राम के बारे में",
  operatedBy: (name: string) => `ReadnShare का संचालन ${name} द्वारा किया जाता है।`,
  contactTitle: "हमसे संपर्क करें",
  contactBody: "सवाल, सुझाव या ऑर्डर में मदद — हमें आपकी बात सुनकर ख़ुशी होगी।",
  contactCta: "संपर्क करें",
  browseCta: "ई-बुक्स देखें",
};

export const about = { en, hi };
