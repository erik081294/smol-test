import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProjectCard from '../components/ProjectCard';

const projects = [
  {
    title: 'Project 1',
    description: 'This is a description of project 1.',
    image: '/images/project1.jpg',
    link: '#',
  },
  {
    title: 'Project 2',
    description: 'This is a description of project 2.',
    image: '/images/project2.jpg',
    link: '#',
  },
  {
    title: 'Project 3',
    description: 'This is a description of project 3.',
    image: '/images/project3.jpg',
    link: '#',
  },
];

export default function Home() {
  return (
    <div>
      <Head>
        <title>My Portfolio</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main>
        <h1>Welcome to my portfolio</h1>
        <section>
          {projects.map((project, index) => (
            <ProjectCard key={index} project={project} />
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}