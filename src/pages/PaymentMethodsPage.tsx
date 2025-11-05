import { useMemo, useState } from "react";
import { CreditCard, Plus, ShieldCheck, Wallet } from "lucide-react";
import MainLayout from "../components/MainLayout";

import "./PlayerSettingsPages.css";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp: string;
  isDefault?: boolean;
}

const mockMethods: PaymentMethod[] = [
  { id: "card-1", brand: "Visa", last4: "4242", exp: "08/26", isDefault: true },
  { id: "card-2", brand: "Amex", last4: "3005", exp: "11/27" },
];

const getBrandClassName = (brand: string) => {
  const key = brand.toLowerCase();
  if (key === "visa") return "payment-card__brand payment-card__brand--visa";
  if (key === "amex" || key === "american express") return "payment-card__brand payment-card__brand--amex";
  if (key === "mastercard") return "payment-card__brand payment-card__brand--mastercard";
  if (key === "discover") return "payment-card__brand payment-card__brand--discover";
  return "payment-card__brand payment-card__brand--default";
};

const PaymentMethodsPage = () => {
  const [methods, setMethods] = useState(mockMethods);
  const defaultMethod = useMemo(() => methods.find((method) => method.isDefault), [methods]);

  const setDefault = (id: string) => {
    setMethods((current) => current.map((method) => ({ ...method, isDefault: method.id === id })));
  };

  const removeMethod = (id: string) => {
    setMethods((current) => current.filter((method) => method.id !== id));
  };

  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero settings-hero--billing">
            <span className="settings-hero__badge">
              <Wallet size={16} aria-hidden="true" />
              Billing center
            </span>
            <h1 className="settings-hero__title">Payment methods</h1>
            <p className="settings-hero__subtitle">
              Securely manage the cards you use for lessons, match fees, and marketplace purchases.
            </p>
          </header>

          {defaultMethod ? (
            <div className="payment-default-card">
              <span className="payment-default-card__label">Default card</span>
              <p className="payment-default-card__brand">
                {defaultMethod.brand} ending in {defaultMethod.last4}
              </p>
              <p className="payment-default-card__meta">Expires {defaultMethod.exp}</p>
              <span className="payment-default-card__security">
                <ShieldCheck size={14} aria-hidden="true" />
                Encrypted payments
              </span>
            </div>
          ) : null}

          <section className="settings-section">
            <div className="billing-grid">
              <div className="payment-methods">
                {methods.length === 0 ? (
                  <div className="payment-methods__empty">
                    <CreditCard className="payment-methods__icon" aria-hidden="true" />
                    <h2 className="settings-card__title">No saved payment methods</h2>
                    <p className="settings-card__subtitle">
                      Add a card to book courts and reserve coaching sessions faster.
                    </p>
                    <button type="button" className="payment-methods__cta">
                      <Plus size={16} aria-hidden="true" />
                      Add payment method
                    </button>
                  </div>
                ) : (
                  <div className="payment-methods__list">
                    {methods.map((method) => (
                      <article key={method.id} className="payment-card">
                        <div className={getBrandClassName(method.brand)}>
                          <span>{method.brand}</span>
                          <span>•••• {method.last4}</span>
                        </div>
                        <div className="payment-card__meta">
                          <span>Expires {method.exp}</span>
                          <div className="payment-card__actions">
                            <button
                              type="button"
                              onClick={() => setDefault(method.id)}
                              className={`payment-card__button ${
                                method.isDefault ? "payment-card__button--default" : "payment-card__button--set-default"
                              }`}
                              disabled={method.isDefault}
                            >
                              {method.isDefault ? "Default" : "Set default"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMethod(method.id)}
                              className="payment-card__button payment-card__button--remove"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="settings-card">
                <h2 className="settings-card__title">Add a payment method</h2>
                <p className="settings-card__subtitle">
                  We support major credit and debit cards. You can safely store more than one method.
                </p>
                <form className="payment-form">
                  <div className="payment-form__field">
                    <label className="payment-form__label" htmlFor="card-number">
                      Card number
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 5678 9012 3456"
                      className="payment-form__input"
                    />
                  </div>
                  <div className="payment-form__row">
                    <div className="payment-form__field">
                      <label className="payment-form__label" htmlFor="card-expiry">
                        Exp date
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/YY"
                        className="payment-form__input"
                      />
                    </div>
                    <div className="payment-form__field">
                      <label className="payment-form__label" htmlFor="card-cvc">
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="text"
                        inputMode="numeric"
                        placeholder="123"
                        className="payment-form__input"
                      />
                    </div>
                  </div>
                  <button type="button" className="payment-form__submit">
                    Save card
                  </button>
                </form>
                <p className="payment-form__note">
                  We use encrypted vault storage and never share your payment details with other players or coaches.
                </p>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentMethodsPage;
