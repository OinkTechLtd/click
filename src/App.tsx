import { CheckCircle2, Clock3, Copy, ExternalLink, FileText, Link2, ListChecks, Lock, Sparkles, TimerReset, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { buildGoUrl, createId, decodeLink } from './linkCodec';
import { getConsent, getSavedLinks, saveConsent, saveLink } from './storage';
import { providerNames, shortenWithFallback } from './shorteners';
import type { ClickLink, Task } from './types';
import './styles.css';

const DEFAULT_WAIT = 60;

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function Duck({ mood }: { mood: 'happy' | 'sad' | 'neutral' }) {
  return (
    <div className={`duck duck--${mood}`} aria-label={mood === 'happy' ? 'Радостная утка' : mood === 'sad' ? 'Плачущая утка' : 'Утка ждёт'}>
      <div className="duck__body">
        <div className="duck__tuft">⌁</div>
        <div className="duck__eye duck__eye--left" />
        <div className="duck__eye duck__eye--right" />
        <div className="duck__beak" />
        {mood === 'sad' && <><span className="tear tear--left" /><span className="tear tear--right" /></>}
        {mood === 'happy' && <span className="duck__smile" />}
      </div>
      <div className="duck__shadow" />
    </div>
  );
}

function ConsentGate({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="consent">
      <div className="consent__card glass">
        <Duck mood="neutral" />
        <p className="eyebrow">Первый запуск Click</p>
        <h1>Перед использованием прочитайте и примите правила сервиса</h1>
        <p>
          Click работает без собственного бэкенда: данные ссылки кодируются в URL, а сокращение выполняется через внешние API. Используя приложение, вы соглашаетесь не публиковать вредоносные, мошеннические и незаконные ссылки.
        </p>
        <div className="consent__links">
          <a href="#/terms">Условия использования</a>
          <a href="#/privacy">Политика конфиденциальности</a>
          <a href="#/faq">FAQ</a>
        </div>
        <button className="button button--primary" onClick={onAccept}>Я прочитал и принимаю условия</button>
      </div>
    </div>
  );
}

function Header({ route }: { route: string }) {
  const links = [
    ['#/', 'Главная'],
    ['#/create', 'Создать ссылку'],
    ['#/docs', 'Документация'],
    ['#/faq', 'FAQ'],
  ];
  return (
    <header className="header">
      <a className="brand" href="#/" aria-label="Click на главную"><span>🦆</span><strong>Click</strong></a>
      <nav>{links.map(([href, label]) => <a className={route === href.slice(1) ? 'active' : ''} key={href} href={href}>{label}</a>)}</nav>
    </header>
  );
}

function Landing() {
  return (
    <main>
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow"><Sparkles size={16} /> короткие ссылки с заданиями</p>
          <h1>Создавайте ссылки, которые открываются только после действий или честного ожидания.</h1>
          <p>Click — фронтенд-сервис в стиле Linkify: пользователь вставляет ссылку, добавляет задания, получает короткий URL, а посетитель проходит задания или ждёт 60 секунд. Если попытаться обмануть таймер — утка грустит.</p>
          <div className="hero__actions">
            <a className="button button--primary" href="#/create">Создать ссылку</a>
            <a className="button" href="#/docs">Как это работает</a>
          </div>
        </div>
        <div className="hero__visual glass"><Duck mood="happy" /><div className="mini-card"><Link2 /> go.click/duck</div><div className="mini-card mini-card--alt"><ListChecks /> задания проверяются</div></div>
      </section>
      <section className="grid three">
        <Feature icon={<Link2 />} title="Несколько API" text={`Fallback-цепочка: ${providerNames().join(', ')}. Если один shortener не отвечает, Click автоматически пробует следующий.`} />
        <Feature icon={<TimerReset />} title="Анти-скип таймера" text="Таймер привязан к реальному времени и видимости вкладки. При резком обходе показывается плачущая утка и доступ блокируется." />
        <Feature icon={<Lock />} title="Без бэкенда" text="Полезная нагрузка хранится в URL. Для GitHub Pages, Netlify, Vercel или любого статического хостинга не нужна база данных." />
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="feature glass"><div className="feature__icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>;
}

function CreatePage() {
  const [destination, setDestination] = useState('');
  const [title, setTitle] = useState('Моя Click-ссылка');
  const [description, setDescription] = useState('Выполните задания, чтобы открыть ссылку.');
  const [waitSeconds, setWaitSeconds] = useState(DEFAULT_WAIT);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [generated, setGenerated] = useState<{ longUrl: string; shortUrl?: string; provider?: string } | null>(null);
  const [status, setStatus] = useState('');
  const savedLinks = getSavedLinks();

  function addTask() {
    setTasks((current) => [...current, { id: createId(), title: '', url: '', seconds: 8 }]);
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!destination.trim()) return;
    setStatus('Готовим ссылку и пробуем внешние API сокращения…');
    const link: ClickLink = {
      version: 1,
      id: createId(),
      destination: normalizeUrl(destination),
      title: title.trim() || 'Click-ссылка',
      description: description.trim(),
      waitSeconds: Math.max(10, Number(waitSeconds) || DEFAULT_WAIT),
      tasks: tasks.filter((task) => task.url.trim()).map((task) => ({ ...task, title: task.title.trim() || 'Открыть задание', url: normalizeUrl(task.url), seconds: Math.max(3, Number(task.seconds) || 8) })),
      createdAt: new Date().toISOString(),
    };
    const longUrl = buildGoUrl(link);
    try {
      const short = await shortenWithFallback(longUrl);
      setGenerated({ longUrl, shortUrl: short.url, provider: short.provider });
      saveLink(short.url);
      setStatus(`Готово: использован ${short.provider}.`);
    } catch (error) {
      setGenerated({ longUrl });
      saveLink(longUrl);
      setStatus(error instanceof Error ? `${error.message} Показана длинная ссылка.` : 'Показана длинная ссылка.');
    }
  }

  return (
    <main className="page">
      <section className="glass form-shell">
        <div><p className="eyebrow"><Link2 size={16} /> конструктор</p><h1>Создать Click-ссылку</h1><p>Если задания не указаны, посетителю нужно просто подождать заданное время на странице перехода.</p></div>
        <form onSubmit={onSubmit} className="builder">
          <label>Финальная ссылка<input required placeholder="https://example.com" value={destination} onChange={(event) => setDestination(event.target.value)} /></label>
          <label>Название<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Таймер ожидания, сек.<input type="number" min="10" max="600" value={waitSeconds} onChange={(event) => setWaitSeconds(Number(event.target.value))} /></label>
          <div className="tasks-head"><h2>Задания</h2><button className="button" type="button" onClick={addTask}>Добавить задание</button></div>
          {tasks.length === 0 && <p className="muted">Заданий нет — будет только ожидание.</p>}
          {tasks.map((task, index) => <div className="task-editor" key={task.id}><strong>Задание {index + 1}</strong><input placeholder="Название задания" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} /><input placeholder="https://t.me/channel или другой сайт" value={task.url} onChange={(event) => updateTask(task.id, { url: event.target.value })} /><input type="number" min="3" max="120" value={task.seconds} onChange={(event) => updateTask(task.id, { seconds: Number(event.target.value) })} /><button className="icon-button" type="button" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}><Trash2 size={18} /></button></div>)}
          <button className="button button--primary" type="submit">Сгенерировать</button>
        </form>
      </section>
      <aside className="result-panel glass">
        <Duck mood={generated ? 'happy' : 'neutral'} />
        <h2>Результат</h2>
        <p>{status || 'Здесь появится короткая ссылка.'}</p>
        {generated && <div className="result-box"><label>Короткая / рабочая ссылка<input readOnly value={generated.shortUrl ?? generated.longUrl} /></label><button className="button" onClick={() => navigator.clipboard.writeText(generated.shortUrl ?? generated.longUrl)}><Copy size={16} /> Скопировать</button><a className="button" href={generated.shortUrl ?? generated.longUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Открыть</a>{generated.provider && <p className="muted">API: {generated.provider}</p>}</div>}
        {savedLinks.length > 0 && <div><h3>Последние ссылки</h3>{savedLinks.slice(0, 5).map((link) => <a className="saved-link" key={link} href={link} target="_blank" rel="noreferrer">{link}</a>)}</div>}
      </aside>
    </main>
  );
}

function GoPage({ payload }: { payload: string }) {
  const link = useMemo(() => decodeLink(payload), [payload]);
  const [secondsLeft, setSecondsLeft] = useState(link?.waitSeconds ?? DEFAULT_WAIT);
  const [startedAt] = useState(Date.now());
  const [tasks, setTasks] = useState<Task[]>(link?.tasks ?? []);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!link) return;
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const expected = Math.max(0, link.waitSeconds - elapsed);
      setSecondsLeft(expected);
      if (elapsed > link.waitSeconds + 5 && expected > 0) setBlocked(true);
    }, 500);
    return () => window.clearInterval(interval);
  }, [link, startedAt]);

  if (!link) return <main className="center-page"><Duck mood="sad" /><h1>Ссылка повреждена</h1><p>Не удалось прочитать данные перехода.</p><a className="button" href="#/create">Создать новую</a></main>;

  const allTasksDone = tasks.every((task) => task.completed);
  const ready = allTasksDone && secondsLeft <= 0 && !blocked;

  function openTask(task: Task) {
    const openedAt = Date.now();
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, openedAt } : item)));
    const child = window.open(task.url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => {
      if (!child) {
        setBlocked(true);
      }
    }, 700);
  }

  function confirmTask(task: Task) {
    if (!task.openedAt || Date.now() - task.openedAt < task.seconds * 1000) {
      setBlocked(true);
      return;
    }
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, completed: true } : item)));
  }

  return (
    <main className="go-page">
      <section className="glass go-card">
        <Duck mood={blocked ? 'sad' : ready ? 'happy' : 'neutral'} />
        <p className="eyebrow"><Clock3 size={16} /> страница перехода</p>
        <h1>{link.title}</h1>
        <p>{link.description}</p>
        {blocked && <div className="alert">Утка плачет: похоже, таймер или задание попытались скипнуть. Обновите страницу и выполните шаги честно.</div>}
        <div className="timer"><span>{Math.max(0, secondsLeft)}</span><small>секунд до доступа</small></div>
        <div className="task-list">
          {tasks.length === 0 ? <p className="muted">Заданий нет — дождитесь окончания таймера.</p> : tasks.map((task, index) => <article className="task" key={task.id}><div><strong>{index + 1}. {task.title}</strong><p>Откройте сайт и вернитесь через {task.seconds} сек.</p></div>{task.completed ? <CheckCircle2 className="ok" /> : <div className="task__actions"><button className="button" onClick={() => openTask(task)}>Открыть</button><button className="button" disabled={!task.openedAt} onClick={() => confirmTask(task)}>Проверить</button></div>}</article>)}
        </div>
        <a className={`button button--primary ${!ready ? 'disabled' : ''}`} href={ready ? link.destination : undefined} target="_self">Перейти по ссылке</a>
      </section>
    </main>
  );
}

function DocsPage({ kind }: { kind: 'docs' | 'faq' | 'terms' | 'privacy' }) {
  const content = {
    docs: ['Документация', 'Click кодирует настройки перехода прямо в hash-часть URL. Конструктор вызывает внешние API сокращения по очереди и сохраняет работоспособную ссылку локально в браузере.', 'Для деплоя соберите npm run build и опубликуйте папку dist на статическом хостинге. Собственный сервер, база данных и приватные ключи не требуются.'],
    faq: ['FAQ', 'Можно ли гарантированно проверить загрузку чужого сайта? В браузере без бэкенда нельзя читать состояние cross-origin страниц, поэтому Click проверяет факт открытия окна, время ожидания и ручное подтверждение после возврата.', 'Что если is.gd недоступен? Приложение автоматически переключается на v.gd, TinyURL или CleanURI и запоминает здоровье провайдеров.'],
    terms: ['Условия использования', 'Запрещено создавать ссылки на фишинг, вредоносное ПО, незаконный контент, спам и материалы, нарушающие права третьих лиц. Автор ссылки отвечает за содержание финального URL и заданий.', 'Сервис предоставляется как есть. Внешние API сокращения могут менять правила, лимиты и доступность.'],
    privacy: ['Политика конфиденциальности', 'Click не имеет собственного бэкенда и не отправляет вашу базу ссылок разработчику. Настройки ссылки передаются внутри URL, а последние созданные ссылки и согласие с правилами хранятся в localStorage браузера.', 'При сокращении URL целевая ссылка передаётся выбранному внешнему shortener API; применяются политики конфиденциальности соответствующего провайдера.'],
  }[kind];
  return <main className="docs glass"><p className="eyebrow"><FileText size={16} /> документы</p><h1>{content[0]}</h1>{content.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="doc-links"><a href="#/terms">Условия</a><a href="#/privacy">Политика</a><a href="#/faq">FAQ</a><a href="#/docs">Docs</a></div></main>;
}

function App() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/');
  const [hasConsent, setHasConsent] = useState(Boolean(getConsent()?.accepted));

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const isDocRoute = ['/terms', '/privacy', '/faq', '/docs'].includes(route);
  if (!hasConsent && !isDocRoute) return <ConsentGate onAccept={() => { saveConsent(); setHasConsent(true); }} />;

  const goMatch = route.match(/^\/go\/(.+)$/);
  return <><Header route={route} />{goMatch ? <GoPage payload={goMatch[1]} /> : route === '/create' ? <CreatePage /> : route === '/docs' ? <DocsPage kind="docs" /> : route === '/faq' ? <DocsPage kind="faq" /> : route === '/terms' ? <DocsPage kind="terms" /> : route === '/privacy' ? <DocsPage kind="privacy" /> : <Landing />}</>;
}

export default App;
