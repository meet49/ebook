/** Contact Us page. */
const en = {
  metaTitle: "Contact us",
  metaDescription: "Get help with an order, your library or the affiliate program.",
  eyebrow: "Contact us",
  titleStart: "We're here to",
  titleAccent: "help",
  titleEnd: "",
  subtitle: "Questions about an order, your library or the affiliate program? Write to us and we'll reply by email.",
  emailLabel: "Email us",
  emailBody: "The fastest way to reach us for anything.",
  emailButton: "Send an email",
  copy: "Copy email",
  copied: "Email copied",
  orderTitle: "Help with an order",
  orderBody: "To help us find your purchase quickly, please include:",
  orderPoints: [
    "Your order number (from the confirmation page or email)",
    "The email address you used at checkout",
    "What went wrong, and a screenshot if possible",
  ],
  orderSubject: "Help with my order",
  quickTitle: "Quick answers",
  quick: [
    {
      q: "I paid but can't see my book",
      a: "Sign in with the email you used at checkout and open My library. Guests also get a sign-in link by email — check your spam folder.",
      link: "/library",
      linkLabel: "Open my library",
    },
    {
      q: "I was charged twice or want a refund",
      a: "Read our refund policy, then write to us with your order number.",
      link: "/legal/refunds",
      linkLabel: "Refund policy",
    },
    {
      q: "How is my eBook delivered?",
      a: "Instantly and digitally — it's added to your online library as soon as the payment is verified. Nothing is shipped.",
      link: "/legal/delivery",
      linkLabel: "Delivery policy",
    },
    {
      q: "Questions about the affiliate program",
      a: "See how referrals, commissions and payouts work.",
      link: "/affiliates",
      linkLabel: "Affiliate program",
    },
  ],
  policies: "Policies",
};

export type ContactMessages = typeof en;

const hi: ContactMessages = {
  metaTitle: "संपर्क करें",
  metaDescription: "ऑर्डर, लाइब्रेरी या एफ़िलिएट प्रोग्राम से जुड़ी मदद पाएँ।",
  eyebrow: "संपर्क करें",
  titleStart: "हम आपकी",
  titleAccent: "मदद",
  titleEnd: " के लिए यहाँ हैं",
  subtitle: "ऑर्डर, लाइब्रेरी या एफ़िलिएट प्रोग्राम के बारे में कोई सवाल है? हमें लिखें, हम ईमेल से जवाब देंगे।",
  emailLabel: "हमें ईमेल करें",
  emailBody: "किसी भी बात के लिए हम तक पहुँचने का सबसे तेज़ तरीका।",
  emailButton: "ईमेल भेजें",
  copy: "ईमेल कॉपी करें",
  copied: "ईमेल कॉपी हो गया",
  orderTitle: "ऑर्डर से जुड़ी मदद",
  orderBody: "आपकी ख़रीदारी जल्दी ढूँढने के लिए कृपया ये बताएँ:",
  orderPoints: [
    "आपका ऑर्डर नंबर (कन्फ़र्मेशन पेज या ईमेल से)",
    "चेकआउट में इस्तेमाल किया गया ईमेल",
    "क्या दिक्कत हुई, और हो सके तो एक स्क्रीनशॉट",
  ],
  orderSubject: "Help with my order",
  quickTitle: "झटपट जवाब",
  quick: [
    {
      q: "पेमेंट हो गया, पर किताब नहीं दिख रही",
      a: "चेकआउट वाले ईमेल से साइन इन करें और मेरी लाइब्रेरी खोलें। गेस्ट को ईमेल पर साइन-इन लिंक भी मिलता है — स्पैम फ़ोल्डर भी देखें।",
      link: "/library",
      linkLabel: "मेरी लाइब्रेरी खोलें",
    },
    {
      q: "पैसे दो बार कट गए या रिफ़ंड चाहिए",
      a: "हमारी रिफ़ंड पॉलिसी पढ़ें, फिर अपने ऑर्डर नंबर के साथ हमें लिखें।",
      link: "/legal/refunds",
      linkLabel: "रिफ़ंड पॉलिसी",
    },
    {
      q: "मेरी ई-बुक कैसे मिलेगी?",
      a: "तुरंत और डिजिटल — पेमेंट कन्फ़र्म होते ही किताब आपकी ऑनलाइन लाइब्रेरी में जुड़ जाती है। कुछ भी शिप नहीं होता।",
      link: "/legal/delivery",
      linkLabel: "डिलीवरी पॉलिसी",
    },
    {
      q: "एफ़िलिएट प्रोग्राम के बारे में सवाल",
      a: "देखें कि रेफ़रल, कमीशन और पेआउट कैसे काम करते हैं।",
      link: "/affiliates",
      linkLabel: "एफ़िलिएट प्रोग्राम",
    },
  ],
  policies: "पॉलिसी",
};

export const contact = { en, hi };
