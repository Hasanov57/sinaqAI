import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Target,
} from "lucide-react";

const features = [
  {
    icon: BookOpenCheck,
    title: "İmtahan formatında məşq",
    text: "Sualları vaxt nəzarəti və rahat naviqasiya ilə həll et.",
  },
  {
    icon: BarChart3,
    title: "Aydın nəticə analizi",
    text: "Düzgün, səhv və cavabsız sualları fənn-fənn gör.",
  },
  {
    icon: BrainCircuit,
    title: "İzahı ehtiyac olanda al",
    text: "Rəsmi cavab əsas götürülərək səhvin səbəbini öyrən.",
  },
  {
    icon: Target,
    title: "Zəif mövzuları müəyyən et",
    text: "Nəticələrin artdıqca hansı mövzulara qayıtmalı olduğunu bil.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Ağıllı imtahan hazırlığı</p>
            <h1>
              DİM imtahanlarına <span>daha hazırlıqlı</span> gir.
            </h1>
            <p>
              İmtahanları həll et, nəticəni dərhal gör və növbəti məşqini
              doğru mövzuya yönəlt.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/exams">
                İmtahanlara bax <ArrowRight size={18} />
              </Link>
              <Link className="button button-secondary" href="/login">
                Hesab yarat
              </Link>
            </div>
            <div className="hero-note">
              <CheckCircle2 size={17} /> Demo imtahanı qeydiyyatsız sınamaq olar
            </div>
          </div>

          <div className="hero-board" aria-label="İmtahan ekranının nümunəsi">
            <div className="board-top">
              <strong>Riyaziyyat</strong>
              <span className="timer-pill"><Clock3 size={14} /> 34:18</span>
            </div>
            <div className="mini-question">
              <span>SUAL 3 / 6</span>
              <h2>3x + 5 = 20 tənliyinin həlli hansıdır?</h2>
              <div className="mini-option"><b>A</b> 3</div>
              <div className="mini-option active"><b>B</b> 5</div>
              <div className="mini-option"><b>C</b> 7</div>
              <div className="mini-option"><b>D</b> 15</div>
              <div className="board-progress"><span /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <h2>Sınaqdan nəticəyə qədər</h2>
            <p>
              Hazırlığın əsas hissələri bir yerdədir. Hesablamalar rəsmi cavab
              məlumatına əsaslanan qaydalarla aparılır.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="feature-card" key={feature.title}>
                  <span className="feature-icon"><Icon size={22} /></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section how-section">
        <div className="shell">
          <div className="section-heading">
            <h2>Sadə iş prinsipi</h2>
            <p>İmtahan seç, diqqətini suallara ver və nəticədən konkret addım çıxar.</p>
          </div>
          <div className="steps">
            <article className="step">
              <span className="step-number">01</span>
              <h3>İmtahanı seç</h3>
              <p>Sinif, il və fənn üzrə uyğun imtahanı tap.</p>
            </article>
            <article className="step">
              <span className="step-number">02</span>
              <h3>Vaxtla həll et</h3>
              <p>Cavabların avtomatik saxlanır, suallar arasında sərbəst keçirsən.</p>
            </article>
            <article className="step">
              <span className="step-number">03</span>
              <h3>Nəticəni təhlil et</h3>
              <p>Hər sualın nəticəsini və mövzular üzrə göstəricini yoxla.</p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
