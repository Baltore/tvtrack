import { Component } from 'react';

// Capture les erreurs de rendu React pour éviter l'écran blanc :
// on affiche un message propre avec un bouton de rechargement.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Erreur interface :', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h1>Oups, une erreur est survenue</h1>
          <p>L'interface a rencontré un problème inattendu. Recharge la page pour continuer.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
