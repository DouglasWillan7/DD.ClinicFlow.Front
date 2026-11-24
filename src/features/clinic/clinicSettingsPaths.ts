// Rotas da configuração da clínica. O índice é a aba "Primeiros passos" enquanto houver
// etapa pendente; com tudo configurado ele redireciona para "Dados da clínica".
export const clinicSettingsPath = "/app/configuracoes/clinica";
export const clinicDataPath = `${clinicSettingsPath}/dados`;
export const clinicHealthcarePlansPath = `${clinicSettingsPath}/convenios`;
export const clinicWhatsAppPath = `${clinicSettingsPath}/whatsapp`;
export const clinicPrescriptionTemplatePath = `${clinicSettingsPath}/receituario`;
