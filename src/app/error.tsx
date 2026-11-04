'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <section className="error-page"><h1>A little pause in the journey.</h1><p>We couldn’t load this page. Please try again, or call 8890 if you need help.</p><button className="button button-dark" onClick={reset}>Try again</button></section>;}
