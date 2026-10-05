import type { Language } from './context'

const phrases = {
  installApp: ['Install Weavly on desktop or mobile', 'ડેસ્કટૉપ કે મોબાઇલ પર Weavly ઇન્સ્ટૉલ કરો', 'डेस्कटॉप या मोबाइल पर Weavly इंस्टॉल करें'],
  confirmPassword: ['Confirm password', 'પાસવર્ડની પુષ્ટિ કરો', 'पासवर्ड की पुष्टि करें'],
  enterPasswordAgain: ['Enter your password again', 'તમારો પાસવર્ડ ફરી દાખલ કરો', 'अपना पासवर्ड फिर दर्ज करें'],
  showPassword: ['Show password', 'પાસવર્ડ બતાવો', 'पासवर्ड दिखाएँ'],
  hidePassword: ['Hide password', 'પાસવર્ડ છુપાવો', 'पासवर्ड छिपाएँ'],
  nameTooShort: ['Name must be at least 2 characters', 'નામ ઓછામાં ઓછું 2 અક્ષરનું હોવું જોઈએ', 'नाम कम से कम 2 अक्षरों का होना चाहिए'],
  invalidEmail: ['Invalid email address', 'ઇમેઇલ સરનામું અમાન્ય છે', 'ईमेल पता अमान्य है'],
  invalidPhone: ['Enter a valid 10-digit Indian mobile number, for example 9876543210.', 'માન્ય 10 અંકનો ભારતીય મોબાઇલ નંબર દાખલ કરો, જેમ કે 9876543210.', 'मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें, जैसे 9876543210.'],
  passwordMismatch: ['Passwords do not match', 'પાસવર્ડ મેળ ખાતા નથી', 'पासवर्ड मेल नहीं खाते'],
  passwordNeeds: ['Password needs: {rules}', 'પાસવર્ડમાં જરૂરી: {rules}', 'पासवर्ड में आवश्यक: {rules}'],
  receiptDocument: ['Payment receipt (PDF)', 'ચુકવણીની રસીદ (PDF)', 'भुगतान रसीद (PDF)'],
  manualRenewal: ['Manual Renewal', 'જાતે નવીનીકરણ', 'स्वयं नवीनीकरण'],
  manualRenewalDescription: ['Annual access with no automatic surprise debits. Renew when you are ready.', 'વાર્ષિક ઍક્સેસ માટે આપમેળે કોઈ ચુકવણી કપાતી નથી. તમે તૈયાર હો ત્યારે નવીનીકરણ કરો.', 'वार्षिक पहुँच के लिए अपने आप कोई भुगतान नहीं कटता। जब आप तैयार हों तब नवीनीकरण करें।'],
  verifiedActivation: ['Instant Activation', 'તાત્કાલિક ઍક્ટિવેશન', 'तुरंत सक्रियण'],
  verifiedActivationDescription: ['Features unlock automatically right after payment verification.', 'ચુકવણીની ચકાસણી પછી સુવિધાઓ આપમેળે શરૂ થાય છે.', 'भुगतान सत्यापन के बाद सुविधाएँ अपने आप शुरू होती हैं।'],
  secureCheckout: ['Secure Checkout', 'સુરક્ષિત ચુકવણી', 'सुरक्षित भुगतान'],
  secureCheckoutDescription: ['Payments processed securely via Razorpay with bank-grade encryption.', 'બૅન્ક સ્તરના એન્ક્રિપ્શન સાથે Razorpay દ્વારા ચુકવણી સુરક્ષિત રીતે થાય છે.', 'बैंक स्तर के एन्क्रिप्शन के साथ Razorpay द्वारा भुगतान सुरक्षित रूप से होता है।'],
  paymentsUnavailable: ['Payments unavailable', 'ચુકવણી ઉપલબ્ધ નથી', 'भुगतान उपलब्ध नहीं है'],
  featurePreview: ['Feature Preview', 'સુવિધાની ઝલક', 'सुविधा की झलक'],
  previewFeatures: ['Plan preview features', 'પ્લાનની સુવિધાઓની ઝલક', 'प्लान की सुविधाओं की झलक'],
  billingTerms: ['Billing terms and trust', 'બિલિંગની શરતો અને વિશ્વાસ', 'बिलिंग की शर्तें और भरोसा'],
  recommended: ['RECOMMENDED', 'ભલામણ કરેલ', 'अनुशंसित'],
  missingVerificationEmail: [
    'The email address is missing from this link. Go back to login to continue with your account.',
    'આ લિંકમાં ઇમેઇલ સરનામું નથી. તમારા ખાતા સાથે આગળ વધવા લૉગિન પર પાછા જાઓ.',
    'इस लिंक में ईमेल पता नहीं है। अपने खाते से आगे बढ़ने के लिए लॉगिन पर वापस जाएँ।',
  ],
} satisfies Record<string, readonly [string, string, string]>

export function freeMobileEntryText(language: Language, key: keyof typeof phrases, values: Record<string, string | number> = {}) {
  return phrases[key][language === 'gu' ? 1 : language === 'hi' ? 2 : 0].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
