/** eBook catalogue: /ebooks page, search, filters, sorting and pagination. */
const en = {
  metaTitle: "All eBooks",
  metaDescription: "Browse every eBook in the store. See what each book covers, compare prices and start reading in seconds.",
  eyebrow: "The ReadnShare store",
  titleBefore: "Find your next",
  titleAccent: "great",
  titleAfter: "read",
  subtitle: "Practical eBooks you can preview, buy securely and start reading in seconds — on any device.",
  search: {
    placeholder: "Search by title, author or topic",
    label: "Search eBooks",
    submit: "Search",
  },
  categories: "Categories",
  allCategories: "All",
  sort: {
    label: "Sort",
    featured: "Featured",
    newest: "Newest",
    priceAsc: "Price: low to high",
    priceDesc: "Price: high to low",
  },
  clearFilters: "Clear filters",
  updating: "Updating results…",
  count: (n: number) => `${n} ${n === 1 ? "eBook" : "eBooks"}`,
  matching: (q: string) => `matching “${q}”`,
  inCategory: (c: string) => `in ${c}`,
  emptyStore: {
    title: "Our first titles are on the way",
    body: "New eBooks appear here the moment they're published. Check back soon!",
  },
  noResults: {
    title: "No eBooks match your search",
    body: "Try a different word, check the spelling or browse all categories.",
  },
  pagination: {
    label: "Pagination",
    previous: "Previous",
    next: "Next",
    page: (n: number) => `Page ${n}`,
    pageOf: (a: number, b: number) => `Page ${a} of ${b}`,
  },
};

export type CatalogMessages = typeof en;

const hi: CatalogMessages = {
  metaTitle: "सभी ई-बुक्स",
  metaDescription: "स्टोर की हर ई-बुक देखें। जानें हर किताब में क्या है, कीमतें मिलाएँ और कुछ ही सेकंड में पढ़ना शुरू करें।",
  eyebrow: "ReadnShare स्टोर",
  titleBefore: "अपनी अगली",
  titleAccent: "बेहतरीन",
  titleAfter: "किताब ढूँढें",
  subtitle: "काम की ई-बुक्स — पहले झलक देखें, सुरक्षित तरीके से ख़रीदें और किसी भी डिवाइस पर तुरंत पढ़ना शुरू करें।",
  search: {
    placeholder: "टाइटल, लेखक या विषय से खोजें",
    label: "ई-बुक्स खोजें",
    submit: "खोजें",
  },
  categories: "कैटेगरी",
  allCategories: "सभी",
  sort: {
    label: "क्रम",
    featured: "ख़ास किताबें",
    newest: "सबसे नई",
    priceAsc: "कीमत: कम से ज़्यादा",
    priceDesc: "कीमत: ज़्यादा से कम",
  },
  clearFilters: "फ़िल्टर हटाएँ",
  updating: "नतीजे अपडेट हो रहे हैं…",
  count: (n: number) => `${n} ${n === 1 ? "ई-बुक" : "ई-बुक्स"}`,
  matching: (q: string) => `“${q}” के लिए`,
  inCategory: (c: string) => `${c} में`,
  emptyStore: {
    title: "हमारी पहली किताबें जल्द आ रही हैं",
    body: "नई ई-बुक्स पब्लिश होते ही यहाँ दिखने लगेंगी। जल्द ही दोबारा देखें!",
  },
  noResults: {
    title: "आपकी खोज से कोई ई-बुक नहीं मिली",
    body: "कोई दूसरा शब्द आज़माएँ, स्पेलिंग जाँचें या सभी कैटेगरी देखें।",
  },
  pagination: {
    label: "पेज नेविगेशन",
    previous: "पिछला",
    next: "अगला",
    page: (n: number) => `पेज ${n}`,
    pageOf: (a: number, b: number) => `पेज ${a} / ${b}`,
  },
};

export const catalog = { en, hi };
