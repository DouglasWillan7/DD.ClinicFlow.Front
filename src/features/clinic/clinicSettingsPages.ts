// Ponto de entrada único das abas da configuração da clínica, para o bundler gerar um só
// pacote: ao trocar de aba o código da outra já está carregado e a tela não pisca.
export { OnboardingPage } from "../onboarding/OnboardingPage";
export { ClinicSettingsPage } from "./ClinicSettingsPage";
export { HealthcarePlansSettingsPage } from "./HealthcarePlansSettingsPage";
export { PrescriptionTemplatePage } from "./prescription-template/PrescriptionTemplatePage";
