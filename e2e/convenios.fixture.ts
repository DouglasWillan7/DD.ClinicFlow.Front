import type { Page } from "@playwright/test";

const clinicId = "22222222-2222-2222-2222-222222222222";

export const plans = [
  { id: "plan-amil", name: "Amil" },
  { id: "plan-bradesco", name: "Bradesco Saúde" },
  { id: "plan-careplus", name: "Care Plus" },
  { id: "plan-golden", name: "Golden Cross" },
  { id: "plan-hapvida", name: "Hapvida NotreDame" },
  { id: "plan-omint", name: "Omint" },
  { id: "plan-porto", name: "Porto Seguro Saúde" },
  { id: "plan-sulamerica", name: "SulAmérica" },
  { id: "plan-unimed", name: "Unimed" },
];

type Mode = "ClinicDefault" | "Custom";

interface State {
  accepted: string[];
  defaults: string[];
  doctors: Record<string, { name: string; mode: Mode; ids: string[] }>;
}

/** Mesmo cenário do desenho em docs/design/convenios. */
function initialState(): State {
  return {
    accepted: ["plan-amil", "plan-bradesco", "plan-porto", "plan-sulamerica", "plan-unimed"],
    defaults: ["plan-amil", "plan-sulamerica", "plan-unimed"],
    doctors: {
      "uc-ana": { name: "Dra. Ana Ribeiro", mode: "ClinicDefault", ids: [] },
      "uc-carlos": {
        name: "Dr. Carlos Mendes",
        mode: "Custom",
        ids: ["plan-amil", "plan-bradesco", "plan-sulamerica"],
      },
      "uc-beatriz": { name: "Dra. Beatriz Lima", mode: "ClinicDefault", ids: [] },
      "uc-rafael": { name: "Dr. Rafael Souza", mode: "Custom", ids: [] },
    },
  };
}

function sessionFor(admin: boolean) {
  const userClinicId = admin ? "uc-ana" : "uc-carlos";
  const name = admin ? "Dra. Ana Ribeiro" : "Dr. Carlos Mendes";
  return {
    userId: `user-${userClinicId}`,
    email: "medico@clinicavital.com.br",
    phone: "+5511988887777",
    clinicId,
    clinicName: "Clínica Vital",
    userClinicId,
    clinicRole: "Doctor",
    isAdmin: admin,
    roles: admin ? ["Doctor", "Admin"] : ["Doctor"],
    name,
    availableClinics: [{
      userClinicId,
      clinicId,
      clinicName: "Clínica Vital",
      role: "Doctor",
      isAdmin: admin,
    }],
    tokens: {
      accessToken: "visual-test-token",
      refreshToken: "visual-test-refresh",
      accessTokenExpiresAtUtc: "2030-08-23T12:00:00Z",
    },
  };
}

/** Simula a API de convênios com o mesmo comportamento do backend (lista efetiva e impacto). */
export async function mockHealthcarePlans(page: Page, { admin }: { admin: boolean }) {
  const state = initialState();
  const writes: Array<{ path: string; body: unknown }> = [];
  const effective = (id: string) => {
    const doctor = state.doctors[id];
    return doctor.mode === "Custom" ? doctor.ids : state.defaults;
  };

  await page.addInitScript((value) => {
    window.sessionStorage.setItem("clinicflow.session", JSON.stringify(value));
  }, sessionFor(admin));

  await page.route("http://localhost:5094/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const json = (body: unknown) => route.fulfill({ status: 200, json: body });
    const clinic = () => ({
      healthcarePlanIds: state.accepted,
      defaultHealthcarePlanIds: state.defaults,
    });

    if (pathname === "/healthcare-plans") return json(plans);
    if (pathname === `/clinics/${clinicId}/members/summary`) {
      return json(Object.entries(state.doctors).map(([userClinicId, doctor]) => ({
        userClinicId,
        userId: `user-${userClinicId}`,
        displayName: doctor.name,
        role: "Doctor",
        isAdmin: userClinicId === "uc-ana",
        specialty: null,
        defaultAppointmentDurationMinutes: 30,
        healthcarePlanMode: doctor.mode,
        effectiveHealthcarePlanCount: effective(userClinicId).length,
      })));
    }
    if (pathname === "/clinics/current/healthcare-plans/impact") {
      const body = request.postDataJSON() as {
        healthcarePlanIds: string[];
        defaultHealthcarePlanIds: string[];
      };
      const removals = state.accepted
        .map((planId) => ({
          healthcarePlanId: planId,
          doctors: Object.entries(state.doctors)
            .filter(([, doctor]) =>
              doctor.mode === "Custom"
                ? doctor.ids.includes(planId) && !body.healthcarePlanIds.includes(planId)
                : state.defaults.includes(planId)
                  && !body.defaultHealthcarePlanIds.includes(planId))
            .map(([userClinicId, doctor]) => ({
              userClinicId,
              displayName: doctor.name,
              mode: doctor.mode,
            })),
        }))
        .filter((removal) => removal.doctors.length > 0);
      return json({ removals });
    }
    if (pathname === "/clinics/current/healthcare-plans") {
      if (request.method() === "PUT") {
        const body = request.postDataJSON() as {
          healthcarePlanIds: string[];
          defaultHealthcarePlanIds: string[];
        };
        writes.push({ path: pathname, body });
        state.accepted = body.healthcarePlanIds;
        state.defaults = body.defaultHealthcarePlanIds;
        for (const doctor of Object.values(state.doctors)) {
          doctor.ids = doctor.ids.filter((id) => state.accepted.includes(id));
        }
      }
      return json(clinic());
    }
    const doctorMatch = pathname.match(
      /^\/clinics\/[^/]+\/members\/([^/]+)\/healthcare-plans$/,
    );
    if (doctorMatch && state.doctors[doctorMatch[1]]) {
      const userClinicId = doctorMatch[1];
      if (request.method() === "PUT") {
        const body = request.postDataJSON() as { mode: Mode; healthcarePlanIds: string[] };
        writes.push({ path: pathname, body });
        state.doctors[userClinicId].mode = body.mode;
        state.doctors[userClinicId].ids = body.mode === "Custom" ? body.healthcarePlanIds : [];
      }
      return json({
        userClinicId,
        mode: state.doctors[userClinicId].mode,
        healthcarePlanIds: effective(userClinicId),
      });
    }
    if (pathname === "/clinics/current") {
      return json({
        id: clinicId,
        name: "Clínica Vital",
        timeZoneId: "America/Sao_Paulo",
        phone: null,
        address: null,
        plan: "Clinic",
        subscriptionStatus: "Active",
        maxDoctors: 10,
        createdAtUtc: "2026-07-01T12:00:00Z",
      });
    }
    if (pathname === "/patients") return json([]);
    // Meu perfil mostra os convênios do médico da sessão junto da conta e da agenda.
    if (pathname === "/users/me") {
      const current = sessionFor(admin);
      return json({
        userId: current.userId,
        email: current.email,
        phone: current.phone,
        name: current.name,
        role: "Doctor",
        isAdmin: admin,
        medicalLicense: "12345",
        medicalLicenseState: "SP",
        specialty: "Gastroenterologia",
      });
    }
    if (/^\/doctors\/[^/]+\/schedule$/.test(pathname)) {
      return json({
        doctorUserId: sessionFor(admin).userId,
        slotDurationMinutes: 30,
        intervals: [],
        blocks: [],
      });
    }
    return route.fulfill({ status: 404, json: { title: "Not found" } });
  });

  return { writes };
}
