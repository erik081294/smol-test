import React from 'react';
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

const Projects = () => (
  <div>
    <Header />
    <h1>Projects</h1>
    <div>
      {projects.map((project, index) => (
        <ProjectCard key={index} project={project} />
      ))}
    </div>
    <Footer />
  </div>
);

export default Projects;