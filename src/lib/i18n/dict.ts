/** Interface text in English and French. Keys missing in French fall back to English, so a screen never shows a raw key. */
export const LANGS = ["en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_COOKIE = "kotaana_lang";
export const LANG_LABEL: Record<Lang, string> = { en: "English", fr: "Français" };
export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

const en = {
  // Navigation
  "nav.dashboard": "Dashboard", "nav.workout": "Workout", "nav.nutrition": "Nutrition", "nav.health": "Health", "nav.progress": "Progress",
  "nav.track": "Track Me", "nav.exercises": "Exercises", "nav.notifications": "Notifications", "nav.settings": "Settings", "nav.signout": "Sign out",
  "nav.members": "Members", "nav.analytics": "Analytics", "nav.subscriptions": "Subscriptions", "nav.gym": "Gym",
  // Settings
  "settings.eyebrow": "SETTINGS", "settings.title": "Settings", "settings.sub": "Your account, training setup and app preferences.",
  "settings.library": "Exercise library", "settings.librarySub": "Browse every exercise and how to do it",
  "settings.profile": "Profile & photo", "settings.profileSub": "Identity and basic body details",
  "settings.workout": "Workout setup", "settings.workoutSub": "Goal, level, equipment and training days",
  "settings.nutrition": "Nutrition preferences", "settings.nutritionSub": "Calories, diet style and foods to avoid",
  "settings.coach": "Coach connection", "settings.coachSub": "Find a coach or manage your coaching relationship",
  "settings.subscription": "Subscription & free trial", "settings.subscriptionSub": "Your access, free trial, renewal and payments",
  "settings.appearance": "Appearance & language", "settings.appearanceSub": "Light or dark theme, English or French",
  // Appearance & language
  "appearance.eyebrow": "APPEARANCE", "appearance.title": "Theme & language", "appearance.sub": "Choose how Kotaana looks and which language it speaks.",
  "appearance.light": "Light", "appearance.lightSub": "Bright, clean interface", "appearance.dark": "Dark", "appearance.darkSub": "Dark interface",
  "appearance.selected": "Selected", "appearance.select": "Select", "appearance.language": "Language",
  "appearance.languageSub": "Menus, plans and your AI reviews are written in this language.",
  // Free trial
  "trial.badgeOffer": "FREE TRIAL", "trial.badgeActive": "free trial", "trial.badgeUsed": "trial used",
  "trial.title": "Try everything free for {n} days",
  "trial.body": "Full access to personal workouts, meal plans, health tracking and reviews for {n} days. No payment needed. You can only start it once — when it ends it cannot be restarted.",
  "trial.start": "Start my {n}-day free trial", "trial.daysLeft": "{n} day(s) of free trial left", "trial.endsOn": "Ends on {date}. Subscribe any time to keep going after that.",
  "trial.usedUp": "Your free trial has been used. It can only be used once — subscribe below to continue.",
  "trial.paidBefore": "The free trial is for new members who have not subscribed before. Renew below to continue.",
  "trial.failed": "Could not start the trial — try again.",
  // Preview (signed in, no access)
  "preview.banner": "You're exploring Kotaana. Look around freely — to get your own plans, start your free trial or subscribe.",
  "preview.bannerUsed": "You're in preview mode. Your access has ended — subscribe to use your plans again. Your data is safe.",
  "preview.bannerCta": "See options", "preview.lockedTitle": "{feature} is part of your plan",
  "preview.lockedBody": "You can look around Kotaana freely. To build and record your own {feature}, start your free trial or subscribe.",
  "preview.cta": "Start free trial or subscribe",
  "preview.workout": "Your personal workout", "preview.nutrition": "Your meal plan", "preview.dashboard": "Your dashboard",
  "preview.tourTitle": "What you get", "preview.tour1": "A workout built every day from your goal, time, level, health and readiness.",
  "preview.tour2": "Meal plans with local foods, calories and protein matched to you.", "preview.tour3": "Injury, illness and pregnancy-safe adjustments.",
  "preview.tour4": "Weekly and monthly reviews that learn from your progress.",
  // Subscription page
  "sub.eyebrow": "PAYMENT", "sub.title": "Your access", "sub.back": "← Settings",
  // Pregnancy
  "preg.title": "Pregnancy", "preg.sub": "Answer these so workouts, calories and reviews follow your pregnancy week by week. Always follow your doctor or midwife.",
  "preg.am": "I am currently pregnant", "preg.method": "How do you know your dates?",
  "preg.m.due": "My due date (from my doctor or scan)", "preg.m.lmp": "First day of my last period", "preg.m.scan": "Weeks + days at a scan",
  "preg.dueDate": "Due date", "preg.lmp": "First day of last period", "preg.cycle": "Usual cycle length (days)",
  "preg.scanDate": "Scan date", "preg.scanWeeks": "Weeks at the scan", "preg.scanDays": "Extra days",
  "preg.prePregWeight": "Weight before pregnancy (kg)", "preg.multiple": "Expecting twins or more",
  "preg.cleared": "My doctor or midwife has said exercise is OK", "preg.complications": "Anything your doctor is watching",
  "preg.symptoms": "How you feel these days", "preg.save": "Save pregnancy details",
  "preg.week": "Week {w} · trimester {t}", "preg.due": "Due {date}", "preg.gain": "Healthy total weight gain: {min}–{max} kg",
  "preg.gainSoFar": "So far: {kg} kg", "preg.kcal": "Extra food this trimester: +{kcal} kcal/day",
  "preg.warn": "Stop exercising and call your doctor straight away if you have bleeding, fluid leaking, regular painful contractions, chest pain, dizziness or fainting, calf pain or swelling, or a headache that does not go away.",
  "preg.notCleared": "Until your doctor says exercise is OK, Kotaana keeps workouts to gentle walking, breathing and stretching.",
  "preg.missingDate": "Add a due date, last period or scan so we can follow your weeks.",
  "common.save": "Save", "common.saved": "Saved.", "common.loading": "Loading…", "common.back": "Back",
} as const;

export type Key = keyof typeof en;

const fr: Partial<Record<Key, string>> = {
  "nav.dashboard": "Tableau de bord", "nav.workout": "Entraînement", "nav.nutrition": "Nutrition", "nav.health": "Santé", "nav.progress": "Progrès",
  "nav.track": "Suivi GPS", "nav.exercises": "Exercices", "nav.notifications": "Notifications", "nav.settings": "Paramètres", "nav.signout": "Se déconnecter",
  "nav.members": "Membres", "nav.analytics": "Analyses", "nav.subscriptions": "Abonnements", "nav.gym": "Salle",
  "settings.eyebrow": "PARAMÈTRES", "settings.title": "Paramètres", "settings.sub": "Votre compte, votre entraînement et vos préférences.",
  "settings.library": "Bibliothèque d'exercices", "settings.librarySub": "Tous les exercices et comment les faire",
  "settings.profile": "Profil et photo", "settings.profileSub": "Identité et mesures de base",
  "settings.workout": "Configuration de l'entraînement", "settings.workoutSub": "Objectif, niveau, équipement et jours d'entraînement",
  "settings.nutrition": "Préférences alimentaires", "settings.nutritionSub": "Calories, régime et aliments à éviter",
  "settings.coach": "Lien avec un coach", "settings.coachSub": "Trouver un coach ou gérer votre suivi",
  "settings.subscription": "Abonnement et essai gratuit", "settings.subscriptionSub": "Votre accès, l'essai gratuit, le renouvellement et les paiements",
  "settings.appearance": "Apparence et langue", "settings.appearanceSub": "Thème clair ou sombre, anglais ou français",
  "appearance.eyebrow": "APPARENCE", "appearance.title": "Thème et langue", "appearance.sub": "Choisissez l'apparence de Kotaana et sa langue.",
  "appearance.light": "Clair", "appearance.lightSub": "Interface lumineuse et épurée", "appearance.dark": "Sombre", "appearance.darkSub": "Interface sombre",
  "appearance.selected": "Choisi", "appearance.select": "Choisir", "appearance.language": "Langue",
  "appearance.languageSub": "Les menus, les plans et vos bilans IA sont rédigés dans cette langue.",
  "trial.badgeOffer": "ESSAI GRATUIT", "trial.badgeActive": "essai gratuit", "trial.badgeUsed": "essai utilisé",
  "trial.title": "Essayez tout gratuitement pendant {n} jours",
  "trial.body": "Accès complet aux entraînements personnalisés, aux plans de repas, au suivi santé et aux bilans pendant {n} jours. Sans paiement. Il ne peut être lancé qu'une seule fois — une fois terminé, il ne peut pas être relancé.",
  "trial.start": "Lancer mon essai gratuit de {n} jours", "trial.daysLeft": "{n} jour(s) d'essai gratuit restant(s)", "trial.endsOn": "Se termine le {date}. Abonnez-vous quand vous voulez pour continuer ensuite.",
  "trial.usedUp": "Votre essai gratuit a été utilisé. Il n'est possible qu'une seule fois — abonnez-vous ci-dessous pour continuer.",
  "trial.paidBefore": "L'essai gratuit est réservé aux nouveaux membres qui ne se sont jamais abonnés. Renouvelez ci-dessous pour continuer.",
  "trial.failed": "Impossible de lancer l'essai — réessayez.",
  "preview.banner": "Vous découvrez Kotaana. Explorez librement — pour obtenir vos propres plans, lancez votre essai gratuit ou abonnez-vous.",
  "preview.bannerUsed": "Vous êtes en mode aperçu. Votre accès est terminé — abonnez-vous pour retrouver vos plans. Vos données sont conservées.",
  "preview.bannerCta": "Voir les options", "preview.lockedTitle": "{feature} fait partie de votre formule",
  "preview.lockedBody": "Vous pouvez explorer Kotaana librement. Pour créer et enregistrer votre {feature}, lancez votre essai gratuit ou abonnez-vous.",
  "preview.cta": "Essai gratuit ou abonnement",
  "preview.workout": "Votre entraînement personnel", "preview.nutrition": "Votre plan de repas", "preview.dashboard": "Votre tableau de bord",
  "preview.tourTitle": "Ce que vous obtenez", "preview.tour1": "Un entraînement créé chaque jour selon votre objectif, votre temps, votre niveau, votre santé et votre forme.",
  "preview.tour2": "Des plans de repas avec des aliments locaux, des calories et des protéines adaptées.", "preview.tour3": "Des ajustements sûrs en cas de blessure, de maladie ou de grossesse.",
  "preview.tour4": "Des bilans hebdomadaires et mensuels qui apprennent de vos progrès.",
  "sub.eyebrow": "PAIEMENT", "sub.title": "Votre accès", "sub.back": "← Paramètres",
  "preg.title": "Grossesse", "preg.sub": "Répondez à ces questions pour que les entraînements, les calories et les bilans suivent votre grossesse semaine après semaine. Suivez toujours l'avis de votre médecin ou sage-femme.",
  "preg.am": "Je suis enceinte", "preg.method": "Comment connaissez-vous vos dates ?",
  "preg.m.due": "Ma date d'accouchement prévue (médecin ou échographie)", "preg.m.lmp": "Premier jour de mes dernières règles", "preg.m.scan": "Semaines + jours à une échographie",
  "preg.dueDate": "Date prévue d'accouchement", "preg.lmp": "Premier jour des dernières règles", "preg.cycle": "Durée habituelle du cycle (jours)",
  "preg.scanDate": "Date de l'échographie", "preg.scanWeeks": "Semaines à l'échographie", "preg.scanDays": "Jours en plus",
  "preg.prePregWeight": "Poids avant la grossesse (kg)", "preg.multiple": "J'attends des jumeaux ou plus",
  "preg.cleared": "Mon médecin ou ma sage-femme m'autorise à faire du sport", "preg.complications": "Ce que votre médecin surveille",
  "preg.symptoms": "Comment vous vous sentez ces jours-ci", "preg.save": "Enregistrer la grossesse",
  "preg.week": "Semaine {w} · trimestre {t}", "preg.due": "Prévue le {date}", "preg.gain": "Prise de poids conseillée au total : {min}–{max} kg",
  "preg.gainSoFar": "Jusqu'ici : {kg} kg", "preg.kcal": "Apport en plus ce trimestre : +{kcal} kcal/jour",
  "preg.warn": "Arrêtez l'effort et appelez votre médecin immédiatement en cas de saignement, de perte de liquide, de contractions régulières et douloureuses, de douleur thoracique, de vertiges ou d'évanouissement, de douleur ou gonflement du mollet, ou de mal de tête persistant.",
  "preg.notCleared": "Tant que votre médecin n'a pas validé le sport, Kotaana limite les séances à la marche douce, la respiration et les étirements.",
  "preg.missingDate": "Ajoutez une date prévue, vos dernières règles ou une échographie pour suivre vos semaines.",
  "common.save": "Enregistrer", "common.saved": "Enregistré.", "common.loading": "Chargement…", "common.back": "Retour",
};

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { en, fr };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>) {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** The sentence added to every AI prompt so reviews, meal names and notes come back in the person's language. */
export function aiLanguageRule(lang: Lang) {
  return lang === "fr" ? " Write every sentence meant for the person in French (français). Keep JSON keys and IDs unchanged." : "";
}
