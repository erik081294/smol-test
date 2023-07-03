import React from 'react';
import styles from '../styles/ProjectCard.module.css';

const ProjectCard = ({ project }) => {
  return (
    <div className={styles.card}>
      <img src={`/images/${project.image}`} alt={project.title} className={styles.cardImage} />
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{project.title}</h3>
        <p className={styles.cardDescription}>{project.description}</p>
        <a href={project.link} className={styles.cardLink}>View Project</a>
      </div>
    </div>
  );
};

export default ProjectCard;