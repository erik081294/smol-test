import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const About = () => {
    return (
        <div>
            <Header />
            <main>
                <h1>About Me</h1>
                <p>This is a paragraph about me. I am a web developer with experience in Next.js, React, and other modern web technologies.</p>
                <img src="/images/profile.jpg" alt="Profile Picture" />
            </main>
            <Footer />
        </div>
    )
}

export default About;