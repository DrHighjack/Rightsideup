"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export interface OnboardingStatus {
  isOnboarded: boolean;
  hasProfile: boolean;
  hasFirstOrder: boolean;
  hasTC: boolean;
  profile: {
    firstName: string;
    phone: string | null;
  };
}

interface RealtorOnboardingBannerProps {
  status: OnboardingStatus;
  completing: boolean;
  onSkip: () => void;
}

interface ChecklistItem {
  key: string;
  label: string;
  href?: string;
  complete: boolean;
  optional?: boolean;
  helperText?: string;
}

const INSTALL_DISMISS_KEY = "realtor_onboarding_install_dismissed";

export default function RealtorOnboardingBanner({ status, completing, onSkip }: RealtorOnboardingBannerProps) {
  const [installDismissed, setInstallDismissed] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
      setInstallDismissed(dismissed);
    } catch (_error) {
      // Ignore browser storage failures and keep default behavior.
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const installComplete = isStandalone || installDismissed;

  const checklistItems = useMemo<ChecklistItem[]>(
    () => [
      {
        key: "profile",
        label: "Complete your profile",
        href: "/dashboard/account",
        complete: status.hasProfile,
      },
      {
        key: "first-order",
        label: "Place your first order",
        href: "/dashboard/orders/new",
        complete: status.hasFirstOrder,
      },
      {
        key: "tc",
        label: "Add a Transaction Coordinator",
        href: "/dashboard/account#tc",
        complete: status.hasTC,
        optional: true,
      },
      {
        key: "install",
        label: "Install the app",
        complete: installComplete,
        helperText: isStandalone
          ? "App already installed on this device."
          : installDismissed
          ? "Install prompt dismissed. You can install later from your browser menu."
          : "Install from your browser menu, or use the install button when available.",
      },
    ],
    [status.hasProfile, status.hasFirstOrder, status.hasTC, installComplete, isStandalone, installDismissed]
  );

  const handleInstall = async () => {
    if (!installPromptEvent) {
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setIsStandalone(true);
    }

    setInstallPromptEvent(null);
  };

  const dismissInstallStep = () => {
    setInstallDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch (_error) {
      // Ignore browser storage failures and keep the in-memory state.
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-blue-900">Welcome to North Shore Sign Co 👋</h2>
          <p className="mt-1 text-sm text-blue-800">Get started in a few quick steps</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {checklistItems.map((item) => (
          <li
            key={item.key}
            className="rounded-lg border border-blue-100 bg-white/90 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    item.complete
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className="text-sm text-slate-800">
                  <span className="font-medium">{item.label}</span>
                  {item.optional ? <span className="ml-2 text-xs text-slate-500">Optional</span> : null}
                </div>
              </div>

              {item.href ? (
                <Link
                  href={item.href}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  Open
                </Link>
              ) : null}
            </div>

            {item.key === "install" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{item.helperText}</span>
                {!installComplete && installPromptEvent ? (
                  <button
                    type="button"
                    onClick={handleInstall}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Install app
                  </button>
                ) : null}
                {!installComplete ? (
                  <button
                    type="button"
                    onClick={dismissInstallStep}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSkip}
          disabled={completing}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {completing ? "Saving..." : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
